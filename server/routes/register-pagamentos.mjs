import { randomUUID } from 'node:crypto'
import { log } from '../lib/logger.mjs'
import { getRequestOrigin } from '../lib/password-reset.mjs'
import { getPerfilUsuario } from '../lib/usuarios.mjs'
import {
  buscarPagamentoPorId,
  criarPreapprovalAssinaturaMensal,
  getMercadoPagoAccessToken,
  getMercadoPagoPublicKey,
  isMercadoPagoConfigured,
  useSandboxCheckout,
} from '../lib/mercadopago.mjs'
import {
  insertPreferenciaRecord,
  listPagamentosUsuario,
  sincronizarPagamentosPendentesDoUsuario,
  sincronizarPreapprovalUsuario,
  sincronizarPreapprovalPorIdFromWebhook,
  atualizarUsuarioDePreapprovalResponse,
  upsertFromWebhookPayment,
} from '../lib/pagamentos-mp.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { logMpWebhook } from '../lib/mp-webhook-log.mjs'
import { errorToText } from '../lib/http/hono-error-map.mjs'

export function registerPagamentosRoutes(app) {
  app.get('/api/pagamentos/config', async (c) => {
    const pk = getMercadoPagoPublicKey()
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
      publicKey: pk || null,
      ready: isMercadoPagoConfigured(),
      isento_pagamento,
    })
  })

  app.get('/api/pagamentos/minhas', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      await sincronizarPagamentosPendentesDoUsuario(usuarioId)
      await sincronizarPreapprovalUsuario(usuarioId).catch(() => {})
      const rows = await listPagamentosUsuario(usuarioId)
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
      const ip = clientKeyFromHono(c)
      if (!rateLimitTake(`mp-pref:${usuarioId}:${ip}`, 15, 60 * 60_000)) {
        return c.json({ message: 'Limite de solicitações de pagamento. Tente de novo em até uma hora.' }, 429)
      }
      if (!isMercadoPagoConfigured()) {
        return c.json({ message: 'Pagamentos não configurados no servidor (MERCADO_PAGO_ACCESS_TOKEN).' }, 503)
      }

      const body = await c.req.json().catch(() => ({}))
      const titulo = String(body?.titulo || 'Assinatura Horizonte Financeiro').trim() || 'Assinatura Horizonte Financeiro'
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
      const externalRef = `hf-${randomUUID()}`

      const pre = await criarPreapprovalAssinaturaMensal({
        baseUrl,
        usuarioId,
        email: perfil.email,
        title: `${titulo} (mensal)`,
        unitPrice: valor,
        externalReference: externalRef,
      })

      await insertPreferenciaRecord({
        usuario_id: usuarioId,
        preference_id: null,
        preapproval_id: String(pre.id),
        external_reference: externalRef,
        amount: valor,
        description: `${titulo} — assinatura mensal`,
      })

      await atualizarUsuarioDePreapprovalResponse(usuarioId, {
        id: pre.id,
        status: pre.status,
        next_payment_date: pre.next_payment_date,
        metadata: { usuario_id: usuarioId },
      })

      const token = getMercadoPagoAccessToken()
      const useSandbox = useSandboxCheckout(token)

      return c.json({
        preapproval_id: pre.id,
        preference_id: null,
        init_point: pre.init_point,
        sandbox_init_point: pre.sandbox_init_point,
        use_sandbox: useSandbox,
      })
    } catch (error) {
      log.error('criar preferencia mp failed', error)
      return c.json({ message: error.message || 'Erro ao criar pagamento.' }, 500)
    }
  })

  /** Mercado Pago envia notificações (IPN / webhooks). Responda 200 rápido. */
  app.get('/api/pagamentos/webhook', (c) => c.json({ ok: true }))

  app.post('/api/pagamentos/webhook', async (c) => {
    let paymentId = null
    let preapprovalWebhookId = null
    let qsTopic = ''
    try {
      const url = new URL(c.req.url)
      qsTopic = (url.searchParams.get('topic') || url.searchParams.get('type') || '').toLowerCase()
      const qsId = url.searchParams.get('id') || url.searchParams.get('data.id')
      if (qsTopic === 'payment' && qsId) paymentId = String(qsId)
      if (
        (qsTopic === 'preapproval' || qsTopic === 'subscription_preapproval' || qsTopic === 'subscription') &&
        qsId
      ) {
        preapprovalWebhookId = String(qsId)
      }

      const ct = c.req.header('content-type') || ''
      if (ct.includes('application/json')) {
        const body = await c.req.json().catch(() => ({}))
        const t = String(body?.type || body?.topic || body?.action || '').toLowerCase()
        if (!paymentId && body?.data?.id != null && t === 'payment') {
          paymentId = String(body.data.id)
        }
        if (!paymentId && body?.id && (t === 'payment' || String(body?.topic || '').toLowerCase() === 'payment')) {
          paymentId = String(body.id)
        }
        if (!paymentId && body?.data?.id != null) {
          const action = String(body?.action || '').toLowerCase()
          if (action.includes('payment')) paymentId = String(body.data.id)
        }
        if (
          !preapprovalWebhookId &&
          (t === 'preapproval' || t === 'subscription_preapproval' || t === 'subscription')
        ) {
          const pid = body?.data?.id ?? body?.id
          if (pid != null) preapprovalWebhookId = String(pid)
        }
      } else if (!paymentId && !preapprovalWebhookId) {
        const text = await c.req.text()
        if (text) {
          const params = new URLSearchParams(text)
          const tp = (params.get('topic') || '').toLowerCase()
          if (tp === 'payment' && params.get('id')) paymentId = String(params.get('id'))
          if ((tp === 'preapproval' || tp === 'subscription_preapproval') && params.get('id')) {
            preapprovalWebhookId = String(params.get('id'))
          }
        }
      }
    } catch (e) {
      logMpWebhook({ stage: 'parse_error', err: errorToText(e) })
      log.error('[MP webhook] parse', e)
    }

    logMpWebhook({
      stage: 'received',
      topic: qsTopic || undefined,
      payment_id: paymentId || undefined,
      preapproval_id: preapprovalWebhookId || undefined,
    })

    if (preapprovalWebhookId) {
      try {
        await sincronizarPreapprovalPorIdFromWebhook(preapprovalWebhookId)
        logMpWebhook({ stage: 'preapproval_ok', preapproval_id: preapprovalWebhookId })
      } catch (e) {
        logMpWebhook({ stage: 'preapproval_error', preapproval_id: preapprovalWebhookId, err: errorToText(e) })
        log.error('[MP webhook] preapproval', e)
      }
      return c.json({ ok: true })
    }

    if (!paymentId) {
      return c.json({ received: true })
    }

    try {
      const payment = await buscarPagamentoPorId(paymentId)
      const extRef =
        payment?.external_reference != null
          ? String(payment.external_reference)
          : payment?.metadata?.external_reference != null
            ? String(payment.metadata.external_reference)
            : undefined
      logMpWebhook({
        stage: 'payment_fetch_ok',
        payment_id: paymentId,
        external_reference: extRef,
        status: payment?.status != null ? String(payment.status) : undefined,
      })
      await upsertFromWebhookPayment(payment)
      logMpWebhook({ stage: 'payment_upsert_ok', payment_id: paymentId })
    } catch (e) {
      logMpWebhook({ stage: 'payment_error', payment_id: paymentId, err: errorToText(e) })
      log.error('[MP webhook] process', e)
    }

    return c.json({ ok: true })
  })
}
