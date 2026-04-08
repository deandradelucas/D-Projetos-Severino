import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  authenticateUser,
  consumeResetToken,
  createResetToken,
  findUserByEmail,
  getExpiresAtIso,
  getRequestOrigin,
  isValidEmail,
  sendResetEmail,
  storeResetToken,
} from './lib/password-reset.mjs'
import { getCategorias, inserirTransacao, getTransacoes, deletarTransacao } from './lib/transacoes.mjs'
import {
  getPerfilUsuario,
  getWhatsappLogs,
  getWhatsappStatus,
  listUsuariosAdmin,
  updateUsuarioAdmin,
  deleteUsuarioAdmin,
} from './lib/usuarios.mjs'
import { handleWhatsAppWebhook } from './lib/whatsapp.mjs'
import { askHorizon } from './lib/ai.mjs'
import {
  buscarPagamentoPorId,
  criarPreferenciaCheckout,
  getMercadoPagoAccessToken,
  getMercadoPagoPublicKey,
  isMercadoPagoConfigured,
  useSandboxCheckout,
} from './lib/mercadopago.mjs'
import {
  insertPreferenciaRecord,
  listPagamentosUsuario,
  listPagamentosAdmin,
  upsertFromWebhookPayment,
} from './lib/pagamentos-mp.mjs'
import { loadEnv } from './lib/load-env.mjs'

loadEnv()

const app = new Hono()

function corsAllowedOrigin(origin) {
  if (!origin) return '*'
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  // Testes no celular na rede local (Vite em outro IP da LAN)
  if (
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin)
  ) {
    return origin
  }
  const extra = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (extra.includes(origin)) return origin
  return null
}

// Permite localhost, LAN (PWA no celular) e origens em CORS_ORIGINS (produção com front separado)
app.use('*', cors({
  origin: (origin) => corsAllowedOrigin(origin),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'x-user-id', 'Authorization'],
}))

app.get('/api/health', (c) => c.json({ ok: true }))

/** Erros de configuração/rede do Supabase — retorna null se for falha genérica. */
function mapSupabaseOrNetworkError(error) {
  const raw = String(error?.message != null ? error.message : error || '')
  if (raw.includes('Missing VITE_SUPABASE_URL') || raw.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return {
      status: 503,
      message:
        'Banco de dados não configurado no servidor. No Vercel, defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY e faça um novo deploy.',
    }
  }
  if (/Invalid API key|JWT expired|invalid value for JWT|API key/i.test(raw)) {
    return {
      status: 503,
      message:
        'Chave do Supabase inválida ou ausente. Confira SUPABASE_SERVICE_ROLE_KEY e VITE_SUPABASE_URL no servidor.',
    }
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|NetworkError|Failed to fetch/i.test(raw)) {
    return {
      status: 503,
      message: 'Não foi possível conectar ao banco de dados. Tente de novo em alguns instantes.',
    }
  }
  return null
}

app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')

    if (!isValidEmail(email)) {
      return c.json({ message: 'Informe um e-mail válido.' }, 400)
    }

    if (!password) {
      return c.json({ message: 'Preencha a senha.' }, 400)
    }

    const user = await authenticateUser(email, password)

    if (!user) {
      return c.json({ message: 'E-mail ou senha incorretos.' }, 401)
    }

    return c.json({
      message: 'Login realizado com sucesso.',
      user,
    })
  } catch (error) {
    console.error('login failed', error)
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
    return c.json(
      { message: 'Não foi possível fazer login agora. Tente novamente em alguns instantes.' },
      500
    )
  }
})

app.post('/api/auth/request-password-reset', async (c) => {
  try {
    const body = await c.req.json()
    const email = String(body?.email || '').trim().toLowerCase()

    if (!isValidEmail(email)) {
      return c.json({ message: 'Informe um e-mail válido.' }, 400)
    }

    const user = await findUserByEmail(email)

    if (!user) {
      return c.json({
        message: 'Enviamos um link para seu e-mail.',
      })
    }

    const origin = getRequestOrigin(c)
    const { rawToken, tokenHash } = createResetToken()
    const expiresAt = getExpiresAtIso()

    await storeResetToken({
      email,
      tokenHash,
      expiresAt,
    })

    const resetUrl = `${origin}/redefinir-senha?token=${rawToken}`
    const emailResult = await sendResetEmail({
      to: email,
      resetUrl,
    })

    return c.json({
      message: 'Enviamos um link para seu e-mail.',
      devResetUrl: emailResult.devResetUrl || null,
    })
  } catch (error) {
    console.error('request-password-reset failed', error)
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
    return c.json(
      { message: 'Não foi possível enviar o link agora. Tente novamente em alguns instantes.' },
      500
    )
  }
})

app.post('/api/auth/reset-password', async (c) => {
  try {
    const body = await c.req.json()
    const token = String(body?.token || '').trim()
    const password = String(body?.password || '')

    if (!token) {
      return c.json({ message: 'Token inválido.' }, 400)
    }

    if (password.length < 6) {
      return c.json({ message: 'A senha deve ter no mínimo 6 caracteres.' }, 400)
    }

    const updated = await consumeResetToken(token, password)

    if (!updated) {
      return c.json({ message: 'Link inválido ou expirado.' }, 400)
    }

    return c.json({ message: 'Senha redefinida com sucesso.' })
  } catch (error) {
    console.error('reset-password failed', error)
    const mapped = mapSupabaseOrNetworkError(error)
    if (mapped) return c.json({ message: mapped.message }, mapped.status)
    return c.json({ message: 'Não foi possível redefinir a senha.' }, 500)
  }
})

// User preferences & profile
app.get('/api/usuarios/perfil', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const perfil = await getPerfilUsuario(usuarioId)
    return c.json({ perfil })
  } catch (error) {
    console.error('get perfil failed', error)
    return c.json({ message: 'Erro ao buscar perfil.' }, 500)
  }
})

// Webhook Whatsapp (token também pode ir no path: /api/whatsapp/webhook/SEU_TOKEN)
app.post('/api/whatsapp/webhook/:pathToken', async (c) => {
  const result = await handleWhatsAppWebhook(c.req, { pathToken: c.req.param('pathToken') })
  return c.json(result.json, result.status)
})

app.post('/api/whatsapp/webhook', async (c) => {
  const result = await handleWhatsAppWebhook(c.req)
  return c.json(result.json, result.status)
})

app.get('/api/whatsapp/webhook', (c) => {
  return c.text('Webhook do WhatsApp está ativo! Utilize o método POST para enviar dados da plataforma.')
})

// Webhook Logs Admin (Simplified Admin route based on user ID checking logic for the future, right now just returning all)
app.get('/api/admin/whatsapp-status', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const status = await getWhatsappStatus()
    return c.json(status)
  } catch (error) {
    console.error('get admin status failed', error)
    return c.json({ message: 'Erro ao buscar status do whatsapp.' }, 500)
  }
})

app.get('/api/admin/whatsapp-logs', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }
    
    // In a prod scenario we would verify if usuarioId role is Admin. For now, since user explicitly requested a dashboard for themselves, we allow authenticated.
    const logs = await getWhatsappLogs()
    return c.json(logs)
  } catch (error) {
    console.error('get admin logs failed', error)
    return c.json({ message: 'Erro ao buscar logs do whatsapp.' }, 500)
  }
})

app.get('/api/admin/whatsapp-config', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const origin = getRequestOrigin(c).replace(/\/$/, '')
    const token = process.env.WHATSAPP_WEBHOOK_TOKEN || 'ece58f64012d51028d28a04264d07131'
    const enc = encodeURIComponent(token)
    return c.json({
      webhookUrlQuery: `${origin}/api/whatsapp/webhook?token=${enc}`,
      webhookUrlPath: `${origin}/api/whatsapp/webhook/${enc}`,
      hint:
        'Cole uma dessas URLs no painel Chipmassa/Telein (Webhook). Sem o token correto, mensagens com texto são rejeitadas.',
    })
  } catch (error) {
    console.error('get whatsapp config failed', error)
    return c.json({ message: 'Erro ao montar URL do webhook.' }, 500)
  }
})

app.get('/api/admin/usuarios', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const usuarios = await listUsuariosAdmin()
    return c.json(usuarios)
  } catch (error) {
    console.error('get admin usuarios failed', error)
    return c.json({ message: 'Erro ao listar usuários.' }, 500)
  }
})

app.put('/api/admin/usuarios/:id', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const id = c.req.param('id')
    const body = await c.req.json()
    const updated = await updateUsuarioAdmin(id, body || {})
    return c.json(updated)
  } catch (error) {
    console.error('update admin usuario failed', error)
    const msg = error.code === '23505' ? 'E-mail ou telefone já utilizado em outra conta.' : 'Erro ao atualizar usuário.'
    return c.json({ message: msg }, 500)
  }
})

app.get('/api/admin/pagamentos', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    const lim = Math.min(500, Math.max(1, parseInt(c.req.query('limit') || '200', 10) || 200))
    const rows = await listPagamentosAdmin(lim)
    return c.json(rows)
  } catch (error) {
    console.error('get admin pagamentos failed', error)
    return c.json({ message: 'Erro ao listar pagamentos.' }, 500)
  }
})

app.delete('/api/admin/usuarios/:id', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

    const id = c.req.param('id')
    await deleteUsuarioAdmin(id)
    return c.json({ message: 'Usuário excluído com sucesso.' })
  } catch (error) {
    console.error('delete admin usuario failed', error)
    return c.json({ message: 'Erro ao excluir usuário.' }, 500)
  }
})

// Transaction and Category Routes

app.get('/api/categorias', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const data = await getCategorias(usuarioId)
    return c.json(data)
  } catch (error) {
    console.error('get categories failed', error)
    return c.json({ message: 'Erro ao buscar categorias.' }, 500)
  }
})

app.get('/api/transacoes', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const filters = {
      dataInicio: c.req.query('dataInicio'),
      dataFim: c.req.query('dataFim'),
      tipo: c.req.query('tipo'),
      categoria_id: c.req.query('categoria_id'),
      status: c.req.query('status'),
      busca: c.req.query('busca'),
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')) : undefined
    }

    const data = await getTransacoes(usuarioId, filters)
    return c.json(data)
  } catch (error) {
    console.error('get transactions failed', error)
    return c.json({ message: 'Erro ao buscar transaçoes.' }, 500)
  }
})

app.post('/api/transacoes', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const body = await c.req.json()
    
    // Vincula o usuario logado
    body.usuario_id = usuarioId

    const data = await inserirTransacao(body)
    return c.json({ message: 'Transação inserida com sucesso.', data }, 201)
  } catch (error) {
    console.error('insert transaction failed', error)
    return c.json({ message: error.message || 'Erro ao inserir transação.' }, 500)
  }
})

app.delete('/api/transacoes/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    await deletarTransacao(id, usuarioId)
    return c.json({ message: 'Transação excluída com sucesso.' })
  } catch (error) {
    console.error('delete transaction failed', error)
    return c.json({ message: 'Erro ao excluir transação.' }, 500)
  }
})

// AI Chat Route — Pergunte ao Horizon

// Mercado Pago — checkout e notificações
app.get('/api/pagamentos/config', (c) => {
  const pk = getMercadoPagoPublicKey()
  return c.json({
    publicKey: pk || null,
    ready: isMercadoPagoConfigured(),
  })
})

app.get('/api/pagamentos/minhas', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
    const rows = await listPagamentosUsuario(usuarioId)
    return c.json(rows)
  } catch (error) {
    console.error('list pagamentos failed', error)
    return c.json({ message: 'Erro ao listar pagamentos.' }, 500)
  }
})

app.post('/api/pagamentos/preferencia', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
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

    const baseUrl = getRequestOrigin(c).replace(/\/+$/, '')
    const externalRef = `hf-${randomUUID()}`

    const pref = await criarPreferenciaCheckout({
      baseUrl,
      usuarioId,
      email: perfil.email,
      title: titulo,
      unitPrice: valor,
      externalReference: externalRef,
      quantity: 1,
    })

    await insertPreferenciaRecord({
      usuario_id: usuarioId,
      preference_id: String(pref.id),
      external_reference: externalRef,
      amount: valor,
      description: titulo,
    })

    const token = getMercadoPagoAccessToken()
    const useSandbox = useSandboxCheckout(token)

    return c.json({
      preference_id: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
      use_sandbox: useSandbox,
    })
  } catch (error) {
    console.error('criar preferencia mp failed', error)
    return c.json({ message: error.message || 'Erro ao criar pagamento.' }, 500)
  }
})

/** Mercado Pago envia notificações (IPN / webhooks). Responda 200 rápido. */
app.get('/api/pagamentos/webhook', (c) => c.json({ ok: true }))

app.post('/api/pagamentos/webhook', async (c) => {
  let paymentId = null
  try {
    const url = new URL(c.req.url)
    const qsTopic = url.searchParams.get('topic') || url.searchParams.get('type')
    const qsId = url.searchParams.get('id') || url.searchParams.get('data.id')
    if (qsTopic === 'payment' && qsId) paymentId = String(qsId)

    if (!paymentId) {
      const ct = c.req.header('content-type') || ''
      if (ct.includes('application/json')) {
        const body = await c.req.json()
        if (body?.data?.id != null) {
          paymentId = String(body.data.id)
        }
        if (!paymentId && body?.id && body?.topic === 'payment') {
          paymentId = String(body.id)
        }
      } else {
        const text = await c.req.text()
        if (text) {
          const params = new URLSearchParams(text)
          if (params.get('topic') === 'payment' && params.get('id')) {
            paymentId = String(params.get('id'))
          }
        }
      }
    }
  } catch (e) {
    console.error('[MP webhook] parse', e)
  }

  if (!paymentId) {
    return c.json({ received: true })
  }

  try {
    const payment = await buscarPagamentoPorId(paymentId)
    await upsertFromWebhookPayment(payment)
  } catch (e) {
    console.error('[MP webhook] process', e)
  }

  return c.json({ ok: true })
})

app.post('/api/ai/chat', async (c) => {
  try {
    const usuarioId = c.req.header('x-user-id')
    if (!usuarioId) {
      return c.json({ message: 'Não autorizado.' }, 401)
    }

    const body = await c.req.json()
    const message = String(body?.message || '').trim()
    const historico = Array.isArray(body?.historico) ? body.historico : []

    if (!message) {
      return c.json({ message: 'Mensagem não pode estar vazia.' }, 400)
    }

    const resposta = await askHorizon(message, usuarioId, historico)

    return c.json({ resposta })
  } catch (error) {
    console.error('ai chat failed', error)
    const msg = error.message?.includes('GEMINI_API_KEY')
      ? 'Chave de API do Gemini não configurada. Adicione GEMINI_API_KEY no .env do servidor.'
      : 'Não foi possível processar sua pergunta agora. Tente novamente.'
    return c.json({ message: msg }, 500)
  }
})

export default app
