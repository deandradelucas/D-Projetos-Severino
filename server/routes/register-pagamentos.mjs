import { randomUUID } from 'node:crypto'
import { log } from '../lib/logger.mjs'
import { getRequestOrigin } from '../lib/password-reset.mjs'
import { getPerfilUsuario } from '../lib/usuarios.mjs'
import { criarAssinaturaComLink, isAsaasConfigured, cancelarAssinaturaAsaas } from '../lib/asaas.mjs'
import {
  insertCheckoutRecord,
  listPagamentosUsuario,
  sincronizarPagamentosPendentesDoUsuario,
  sincronizarSubscriptionPorIdFromWebhook,
  sincronizarSubscriptionUsuario,
  upsertFromWebhookAsaasPayment,
} from '../lib/pagamentos-asaas.mjs'
import { handleStripeWebhookEvent, sincronizarStripeUsuario } from '../lib/pagamentos-stripe.mjs'
import { criarStripeSubscriptionCheckoutSession } from '../lib/stripe-checkout.mjs'
import { getStripe, isStripeConfigured } from '../lib/stripe-client.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { logAsaasWebhook } from '../lib/asaas-webhook-log.mjs'
import { errorToText } from '../lib/http/hono-error-map.mjs'
import { assertSessaoRotasPagamento } from '../lib/assinatura.mjs'
import { resolveEscopoUsuario } from '../lib/conta-familiar.mjs'
import { subscriptionIdFromAsaasWebhookBody } from '../lib/asaas-webhook-subscription-id.mjs'
import { parseUsuarioIdFromExternalReference } from '../lib/asaas.mjs'
import { getSupabaseAdmin } from '../lib/supabase-admin.mjs'
import { Alerts } from '../lib/notify-telegram.mjs'
import { AsaasPixPrecisaCpfError, criarPixAnualComQrCode } from '../lib/asaas-pix-qr.mjs'
import { assertAgendaCronSecret } from '../lib/http/agenda-route-auth.mjs'
import { processExtratoRenovacaoCron } from '../lib/extrato-renovacao.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

async function buscarUidPorSubscriptionId(sid) {
  if (!sid) return null
  try {
    const { data } = await getSupabaseAdmin().from('usuarios').select('id').eq('asaas_subscription_id', sid).maybeSingle()
    return data?.id || null
  } catch { return null }
}

async function buscarInfoUsuario(uid) {
  if (!uid) return null
  try {
    const { data } = await getSupabaseAdmin().from('usuarios').select('nome, email').eq('id', uid).maybeSingle()
    return data
  } catch { return null }
}

export function registerPagamentosRoutes(app) {
  app.get('/api/pagamentos/config', async (c) => {
    let isento_pagamento = false
    const uid = resolveRequestUserId(c)
    if (uid) {
      try {
        const perfil = await getPerfilUsuario(uid)
        isento_pagamento = perfil?.isento_pagamento === true
      } catch {
        /* ignore */
      }
    }
    const precoMensal = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10')
    const precoAnual = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO_ANUAL || '100')
    return c.json({
      publicKey: null,
      ready: isAsaasConfigured(),
      stripe_checkout_ready: isStripeConfigured(),
      stripe_publishable_key: String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim() || null,
      isento_pagamento,
      preco_mensal: Number.isFinite(precoMensal) && precoMensal > 0 ? precoMensal : 10,
      preco_anual: Number.isFinite(precoAnual) && precoAnual > 0 ? precoAnual : 100,
    })
  })

  app.get('/api/pagamentos/minhas', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertSessaoRotasPagamento(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)
      let billingId = usuarioId
      try {
        const escopo = await resolveEscopoUsuario(usuarioId)
        billingId = escopo.dataUsuarioId
      } catch {
        /* mantém usuarioId */
      }
      await sincronizarPagamentosPendentesDoUsuario(billingId)
      await sincronizarSubscriptionUsuario(billingId).catch(() => {})
      await sincronizarStripeUsuario(billingId).catch(() => {})
      const rows = await listPagamentosUsuario(billingId)
      return c.json(rows)
    } catch (error) {
      log.error('list pagamentos failed', error)
      return c.json({ message: 'Erro ao listar pagamentos.' }, 500)
    }
  })

  app.post('/api/pagamentos/preferencia', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertSessaoRotasPagamento(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)
      try {
        const escopo = await resolveEscopoUsuario(usuarioId)
        if (escopo.isMembroConta) {
          return c.json(
            {
              message:
                'Quem paga a assinatura é o titular da conta familiar. Peça para ele concluir o pagamento em Configurações ou Pagamento.',
            },
            403,
          )
        }
      } catch {
        return c.json({ message: 'Não autorizado.' }, 401)
      }
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`asaas-checkout:${usuarioId}:${ip}`, 15, 60 * 60_000)) {
        return c.json({ message: 'Limite de solicitações de pagamento. Tente de novo em até uma hora.' }, 429)
      }
      if (!isAsaasConfigured()) {
        return c.json({ message: 'Pagamentos não configurados no servidor (ASAAS_API_KEY).' }, 503)
      }

      const body = await c.req.json().catch(() => ({}))
      const titulo = String(body?.titulo || 'Assinatura Severino').trim() || 'Assinatura Severino'
      const cpfCnpj = String(body?.cpf_cnpj || '').replace(/\D/g, '').slice(0, 14)
      if (!cpfCnpj) {
        return c.json({ message: 'Informe seu CPF ou CNPJ para continuar.' }, 400)
      }

      const precoMensalCfg = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10')
      const precoAnualCfg = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO_ANUAL || '100')
      const pm = Number.isFinite(precoMensalCfg) && precoMensalCfg > 0 ? precoMensalCfg : 10
      const pa = Number.isFinite(precoAnualCfg) && precoAnualCfg > 0 ? precoAnualCfg : 100

      const planoRaw = String(body?.plano || 'mensal').trim().toLowerCase()
      const plano = planoRaw === 'anual' ? 'anual' : 'mensal'

      const cycle = plano === 'anual' ? 'YEARLY' : 'MONTHLY'
      const valor = plano === 'anual' ? pa : pm

      const perfil = await getPerfilUsuario(usuarioId)
      if (!perfil?.email) {
        return c.json({ message: 'Perfil sem e-mail. Atualize seu cadastro.' }, 400)
      }
      if (perfil.isento_pagamento === true) {
        return c.json({
          message: 'Sua conta está marcada como isenta de pagamento. Não é necessário concluir o checkout.',
        }, 403)
      }

      const baseUrl = getRequestOrigin(c).replace(/\/+$/, '')
      const externalRef = `hf-${usuarioId}-${randomUUID()}`

      const labelCiclo = plano === 'anual' ? 'anual' : 'mensal'

      const resultado = await criarAssinaturaComLink({
        baseUrlApp: baseUrl,
        usuarioId,
        email: perfil.email,
        nome: perfil.nome ?? perfil.usuario ?? '',
        telefone: perfil.telefone ?? '',
        cpfCnpj,
        tituloItem: `${titulo} (${labelCiclo})`,
        valor,
        cycle,
        externalReference: externalRef,
      })

      const checkoutUrl = resultado.checkoutUrl
      const checkoutId = String(resultado.id || '')

      await insertCheckoutRecord({
        usuario_id: usuarioId,
        checkout_id: checkoutId,
        external_reference: externalRef,
        amount: valor,
        description: `${titulo} — assinatura ${labelCiclo}`,
      })

      return c.json({
        checkout_id: checkoutId,
        checkout_url: checkoutUrl,
        preapproval_id: null,
        preference_id: null,
        init_point: checkoutUrl,
        sandbox_init_point: checkoutUrl,
        use_sandbox: false,
      })
    } catch (error) {
      log.error('criar checkout asaas failed', error)
      return c.json({ message: error.message || 'Erro ao criar pagamento.' }, 500)
    }
  })

  app.post('/api/pagamentos/asaas/pix-anual-qrcode', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertSessaoRotasPagamento(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)
      try {
        const escopo = await resolveEscopoUsuario(usuarioId)
        if (escopo.isMembroConta) {
          return c.json(
            {
              message:
                'Quem paga a assinatura é o titular da conta familiar. Peça para ele concluir o pagamento em Configurações ou Pagamento.',
            },
            403,
          )
        }
      } catch {
        return c.json({ message: 'Não autorizado.' }, 401)
      }
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`asaas-pix-qr:${usuarioId}:${ip}`, 10, 60 * 60_000)) {
        return c.json({ message: 'Limite de pedidos de QR Pix. Tente de novo em até uma hora.' }, 429)
      }
      if (!isAsaasConfigured()) {
        return c.json({ message: 'Asaas não configurado (ASAAS_API_KEY).' }, 503)
      }

      const body = await c.req.json().catch(() => ({}))
      const cpfRaw = body?.cpf_cnpj != null ? String(body.cpf_cnpj) : ''

      const perfil = await getPerfilUsuario(usuarioId)
      if (!perfil?.email) {
        return c.json({ message: 'Perfil sem e-mail. Atualize seu cadastro.' }, 400)
      }
      if (perfil.isento_pagamento === true) {
        return c.json({ message: 'Conta isenta — sem cobrança Pix.' }, 403)
      }

      const precoAnualCfg = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO_ANUAL || '100')
      const pa = Number.isFinite(precoAnualCfg) && precoAnualCfg > 0 ? precoAnualCfg : 100

      const out = await criarPixAnualComQrCode({
        usuarioId,
        email: perfil.email,
        nome: perfil.nome ?? perfil.usuario ?? '',
        valorAnual: pa,
        descricao: 'Severino — plano anual (Pix)',
        cpfCnpjOpcional: cpfRaw,
      })

      return c.json({
        payment_id: out.payment_id,
        encoded_image: out.encoded_image,
        payload: out.payload,
        expiration_date: out.expiration_date,
        due_date: out.due_date,
        needs_cpf: false,
      })
    } catch (error) {
      if (error instanceof AsaasPixPrecisaCpfError) {
        return c.json(
          {
            needs_cpf: true,
            message: error.message || 'Informe CPF ou CNPJ para criar o cliente no Asaas.',
          },
          422,
        )
      }
      log.error('pix anual qrcode failed', error)
      return c.json({ message: error.message || 'Erro ao gerar QR Code Pix.' }, 500)
    }
  })

  app.post('/api/pagamentos/stripe/checkout', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertSessaoRotasPagamento(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)
      try {
        const escopo = await resolveEscopoUsuario(usuarioId)
        if (escopo.isMembroConta) {
          return c.json(
            {
              message:
                'Quem paga a assinatura é o titular da conta familiar. Peça para ele concluir o pagamento em Configurações ou Pagamento.',
            },
            403,
          )
        }
      } catch {
        return c.json({ message: 'Não autorizado.' }, 401)
      }
      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`stripe-checkout:${usuarioId}:${ip}`, 15, 60 * 60_000)) {
        return c.json({ message: 'Limite de solicitações de pagamento. Tente de novo em até uma hora.' }, 429)
      }
      if (!isStripeConfigured()) {
        return c.json({ message: 'Stripe não configurado no servidor (STRIPE_SECRET_KEY).' }, 503)
      }

      const body = await c.req.json().catch(() => ({}))
      const planoRaw = String(body?.plano || 'mensal').trim().toLowerCase()
      const plano = planoRaw === 'anual' ? 'anual' : 'mensal'

      const perfil = await getPerfilUsuario(usuarioId)
      if (!perfil?.email) {
        return c.json({ message: 'Perfil sem e-mail. Atualize seu cadastro.' }, 400)
      }
      if (perfil.isento_pagamento === true) {
        return c.json({
          message: 'Sua conta está marcada como isenta de pagamento. Não é necessário concluir o checkout.',
        }, 403)
      }

      const baseUrl = getRequestOrigin(c).replace(/\/+$/, '')
      const session = await criarStripeSubscriptionCheckoutSession({
        usuarioId,
        email: perfil.email,
        plano,
        baseUrlApp: baseUrl,
      })
      const url = session?.url ? String(session.url) : ''
      if (!url) {
        log.error('stripe checkout sem url', session?.id)
        return c.json({ message: 'Resposta inválida do Stripe ao criar checkout.' }, 502)
      }

      return c.json({
        checkout_url: url,
        preapproval_id: null,
        preference_id: null,
        init_point: url,
        sandbox_init_point: url,
        use_sandbox: false,
      })
    } catch (error) {
      log.error('criar checkout stripe failed', error)
      return c.json({ message: error.message || 'Erro ao criar checkout Stripe.' }, 500)
    }
  })

  app.post('/api/pagamentos/stripe/webhook', async (c) => {
    const stripe = getStripe()
    const whSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
    if (!stripe || !whSecret) {
      log.warn('[stripe webhook] STRIPE_WEBHOOK_SECRET ou STRIPE_SECRET_KEY ausente')
      return c.json({ message: 'Webhook Stripe não configurado.' }, 503)
    }
    const sig = c.req.header('stripe-signature')
    if (!sig) return c.json({ message: 'Assinatura ausente.' }, 400)
    let event
    try {
      const raw = await c.req.text()
      event = stripe.webhooks.constructEvent(raw, sig, whSecret)
    } catch (e) {
      log.warn('[stripe webhook] verify', e?.message || e)
      return c.json({ message: 'Assinatura inválida.' }, 400)
    }
    await handleStripeWebhookEvent(event)
    return c.json({ received: true })
  })

  app.post('/api/pagamentos/cancelar', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      const ip = clientKeyFromHono(c)
      if (!await rateLimitTake(`cancelar-assinatura:${usuarioId}:${ip}`, 3, 60 * 60_000)) {
        return c.json({ message: 'Limite de tentativas. Tente de novo em uma hora.' }, 429)
      }

      const { data: user } = await getSupabaseAdmin()
        .from('usuarios')
        .select('asaas_subscription_id, nome, email')
        .eq('id', usuarioId)
        .maybeSingle()

      if (!user?.asaas_subscription_id) {
        return c.json({ message: 'Nenhuma assinatura Asaas ativa encontrada.' }, 404)
      }

      await cancelarAssinaturaAsaas(user.asaas_subscription_id)

      await getSupabaseAdmin()
        .from('usuarios')
        .update({ assinatura_asaas_status: 'INACTIVE' })
        .eq('id', usuarioId)

      void Alerts.assinaturaCancelada({ nome: user.nome, email: user.email || '?', motivo: 'cancelada pelo usuário' }).catch(() => {})
      log.info('[pagamentos] assinatura cancelada pelo usuario', { usuarioId, subscriptionId: user.asaas_subscription_id })

      return c.json({ ok: true, message: 'Assinatura cancelada com sucesso.' })
    } catch (error) {
      log.error('cancelar assinatura failed', error)
      return c.json({ message: 'Erro ao cancelar assinatura. Tente novamente.' }, 500)
    }
  })

  app.get('/api/pagamentos/webhook', (c) => c.json({ ok: true }))

  app.post('/api/pagamentos/webhook', async (c) => {
    const secret = String(process.env.ASAAS_WEBHOOK_TOKEN || '').trim()
    if (!secret) {
      log.warn('[asaas webhook] ASAAS_WEBHOOK_TOKEN não configurado — requisição rejeitada')
      return c.json({ message: 'Webhook não configurado.' }, 503)
    }
    /* Asaas envia o token no header asaas-access-token; fallback para ?token= (legado). */
    const headerTok = String(c.req.header('asaas-access-token') || '').trim()
    const url = new URL(c.req.url)
    const queryTok = String(url.searchParams.get('token') || '').trim()
    const tok = headerTok || queryTok
    if (!headerTok && queryTok) {
      log.warn('[asaas webhook] token via query string (deprecado) — mover para header asaas-access-token')
    }
    if (tok !== secret) {
      return c.json({ message: 'Forbidden.' }, 403)
    }

    let body = {}
    try {
      body = await c.req.json()
    } catch (e) {
      logAsaasWebhook({ stage: 'parse_error', err: errorToText(e) })
      return c.json({ ok: true })
    }

    const ev = String(body?.event || '')
    logAsaasWebhook({ stage: 'received', event: ev || undefined })

    try {
      if (ev.startsWith('SUBSCRIPTION_')) {
        const sid = subscriptionIdFromAsaasWebhookBody(body)
        if (sid) {
          await sincronizarSubscriptionPorIdFromWebhook(sid)
          logAsaasWebhook({ stage: 'subscription_ok', subscription_id: sid })
          if (ev === 'SUBSCRIPTION_INACTIVATED' || ev === 'SUBSCRIPTION_DELETED') {
            void (async () => {
              const uid = await buscarUidPorSubscriptionId(sid)
              const u = await buscarInfoUsuario(uid)
              const motivo = ev === 'SUBSCRIPTION_DELETED' ? 'cancelada' : 'inativada'
              await Alerts.assinaturaCancelada({ nome: u?.nome, email: u?.email || '?', motivo })
            })().catch(() => {})
          }
        } else {
          logAsaasWebhook({ stage: 'subscription_skip', event: ev || undefined, reason: 'missing_subscription_id' })
        }
        return c.json({ ok: true })
      }

      if (body.payment && ev.startsWith('PAYMENT_')) {
        await upsertFromWebhookAsaasPayment(body.payment)
        logAsaasWebhook({ stage: 'payment_ok', payment_id: body.payment.id })
        const p = body.payment
        if ((ev === 'PAYMENT_CONFIRMED' || ev === 'PAYMENT_RECEIVED') && p.subscription) {
          void (async () => {
            const uid = parseUsuarioIdFromExternalReference(p.externalReference)
              || await buscarUidPorSubscriptionId(p.subscription)
            const u = await buscarInfoUsuario(uid)
            await Alerts.novaAssinaturaPaga({ nome: u?.nome, email: u?.email || '?', valor: p.value, metodo: p.billingType, paymentId: p.id })
          })().catch(() => {})
        }
        if (ev === 'PAYMENT_OVERDUE' && p.subscription) {
          void (async () => {
            const uid = parseUsuarioIdFromExternalReference(p.externalReference)
              || await buscarUidPorSubscriptionId(p.subscription)
            const u = await buscarInfoUsuario(uid)
            await Alerts.assinaturaCancelada({ nome: u?.nome, email: u?.email || '?', motivo: 'inadimplente' })
          })().catch(() => {})
        }
        return c.json({ ok: true })
      }

      if (body.object === 'payment' && body.id) {
        await upsertFromWebhookAsaasPayment(body)
        logAsaasWebhook({ stage: 'payment_ok', payment_id: body.id })
        return c.json({ ok: true })
      }
    } catch (e) {
      logAsaasWebhook({ stage: 'handler_error', err: errorToText(e) })
      log.error('[Asaas webhook]', e)
    }

    return c.json({ ok: true })
  })

  app.get('/api/cron/extrato-renovacao', async (c) => {
    const auth = assertAgendaCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)
    try {
      const daysAhead = Math.max(1, Math.min(7, Number(c.req.query('days') || '3')))
      const result = await processExtratoRenovacaoCron({ daysAhead })
      log.info('[cron] extrato-renovacao', result)
      return c.json(result)
    } catch (error) {
      log.error('cron extrato-renovacao', error)
      return c.json({ message: error.message || 'Erro no cron de extrato.' }, 500)
    }
  })
}
