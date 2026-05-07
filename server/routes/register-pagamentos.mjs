import { randomUUID } from 'node:crypto'
import { log } from '../lib/logger.mjs'
import { getRequestOrigin } from '../lib/password-reset.mjs'
import { getPerfilUsuario } from '../lib/usuarios.mjs'
import {
  criarCheckoutAssinaturaRecorrente,
  isAsaasConfigured,
  montarUrlCheckoutAsaas,
} from '../lib/asaas.mjs'
import {
  insertCheckoutRecord,
  listPagamentosUsuario,
  sincronizarPagamentosPendentesDoUsuario,
  sincronizarSubscriptionPorIdFromWebhook,
  sincronizarSubscriptionUsuario,
  upsertFromWebhookAsaasPayment,
} from '../lib/pagamentos-asaas.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { logAsaasWebhook } from '../lib/asaas-webhook-log.mjs'
import { errorToText } from '../lib/http/hono-error-map.mjs'
import { assertAcessoAppUsuario } from '../lib/assinatura.mjs'
import { resolveEscopoUsuario } from '../lib/conta-familiar.mjs'

export function registerPagamentosRoutes(app) {
  app.get('/api/pagamentos/config', async (c) => {
    let isento_pagamento = false
    const uid = c.req.header('x-user-id')
    if (uid) {
      try {
        const perfil = await getPerfilUsuario(uid)
        isento_pagamento = perfil?.isento_pagamento === true
      } catch {
        /* ignore */
      }
    }
    return c.json({
      publicKey: null,
      ready: isAsaasConfigured(),
      isento_pagamento,
    })
  })

  app.get('/api/pagamentos/minhas', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertAcessoAppUsuario(usuarioId)
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
      const rows = await listPagamentosUsuario(billingId)
      return c.json(rows)
    } catch (error) {
      log.error('list pagamentos failed', error)
      return c.json({ message: 'Erro ao listar pagamentos.' }, 500)
    }
  })

  app.post('/api/pagamentos/preferencia', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertAcessoAppUsuario(usuarioId)
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
      if (!rateLimitTake(`asaas-checkout:${usuarioId}:${ip}`, 15, 60 * 60_000)) {
        return c.json({ message: 'Limite de solicitações de pagamento. Tente de novo em até uma hora.' }, 429)
      }
      if (!isAsaasConfigured()) {
        return c.json({ message: 'Pagamentos não configurados no servidor (ASAAS_API_KEY).' }, 503)
      }

      const body = await c.req.json().catch(() => ({}))
      const titulo = String(body?.titulo || 'Assinatura Severino').trim() || 'Assinatura Severino'
      const valorRaw = body?.valor
      const defaultPreco = Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10')
      const valor = Number(valorRaw != null && valorRaw !== '' ? valorRaw : defaultPreco)
      if (!Number.isFinite(valor) || valor <= 0) {
        return c.json({ message: 'Valor inválido.' }, 400)
      }

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

      const checkout = await criarCheckoutAssinaturaRecorrente({
        baseUrlApp: baseUrl,
        usuarioId,
        email: perfil.email,
        nome: perfil.nome ?? perfil.usuario ?? '',
        telefone: perfil.telefone ?? '',
        tituloItem: `${titulo} (mensal)`,
        valorMensal: valor,
        externalReference: externalRef,
      })

      const checkoutId =
        checkout?.id != null
          ? String(checkout.id)
          : checkout?.checkoutSessionId != null
            ? String(checkout.checkoutSessionId)
            : checkout?.checkoutId != null
              ? String(checkout.checkoutId)
              : ''

      if (!checkoutId) {
        log.error('asaas checkout sem id', checkout)
        return c.json({ message: 'Resposta inválida do Asaas ao criar checkout.' }, 502)
      }

      const checkoutUrl = montarUrlCheckoutAsaas(checkoutId)
      if (!checkoutUrl) {
        return c.json({ message: 'Não foi possível montar o link do checkout.' }, 502)
      }

      await insertCheckoutRecord({
        usuario_id: usuarioId,
        checkout_id: checkoutId,
        external_reference: externalRef,
        amount: valor,
        description: `${titulo} — assinatura mensal`,
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

  app.get('/api/pagamentos/webhook', (c) => c.json({ ok: true }))

  app.post('/api/pagamentos/webhook', async (c) => {
    const secret = String(process.env.ASAAS_WEBHOOK_TOKEN || '').trim()
    if (secret) {
      const url = new URL(c.req.url)
      const tok = url.searchParams.get('token') || ''
      if (tok !== secret) {
        return c.json({ message: 'Forbidden.' }, 403)
      }
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
      if (body.subscription && ev.startsWith('SUBSCRIPTION_')) {
        const sid = body.subscription.id ?? body.subscription.subscription
        if (sid) {
          await sincronizarSubscriptionPorIdFromWebhook(String(sid))
          logAsaasWebhook({ stage: 'subscription_ok', subscription_id: String(sid) })
        }
        return c.json({ ok: true })
      }

      if (body.payment && ev.startsWith('PAYMENT_')) {
        await upsertFromWebhookAsaasPayment(body.payment)
        logAsaasWebhook({ stage: 'payment_ok', payment_id: body.payment.id })
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
}
