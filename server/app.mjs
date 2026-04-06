import { Hono } from 'hono'
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
import { askHorizon } from './lib/ai.mjs'

const app = new Hono()

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')

    if (!isValidEmail(email)) {
      return c.json({ message: 'Informe um e-mail valido.' }, 400)
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
    return c.json({ message: 'Nao foi possivel fazer login agora. Tente novamente em instantes.' }, 500)
  }
})

app.post('/api/auth/request-password-reset', async (c) => {
  try {
    const body = await c.req.json()
    const email = String(body?.email || '').trim().toLowerCase()

    if (!isValidEmail(email)) {
      return c.json({ message: 'Informe um e-mail valido.' }, 400)
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
    return c.json({ message: 'Nao foi possivel enviar o link agora. Tente novamente em instantes.' }, 500)
  }
})

app.post('/api/auth/reset-password', async (c) => {
  try {
    const body = await c.req.json()
    const token = String(body?.token || '').trim()
    const password = String(body?.password || '')

    if (!token) {
      return c.json({ message: 'Token invalido.' }, 400)
    }

    if (password.length < 6) {
      return c.json({ message: 'A senha deve ter no minimo 6 caracteres.' }, 400)
    }

    const updated = await consumeResetToken(token, password)

    if (!updated) {
      return c.json({ message: 'Link invalido ou expirado.' }, 400)
    }

    return c.json({ message: 'Senha redefinida com sucesso.' })
  } catch (error) {
    console.error('reset-password failed', error)
    return c.json({ message: 'Nao foi possivel redefinir a senha.' }, 500)
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
