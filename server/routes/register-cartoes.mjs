import { log } from '../lib/logger.mjs'
import {
  listarCartoesComResumo,
  criarCartao,
  atualizarCartao,
  excluirCartao,
  faturaDoCartao,
  buscarTransacoesCartao,
  listarParceladasCartao,
} from '../lib/cartoes.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

function resolveCartaoDataId(parsed, c) {
  return c.req.query('pessoal') === '1' ? parsed.actorId : parsed.dataUsuarioId
}

export function registerCartoesRoutes(app) {
  // GET /api/cartoes — lista com resumo da fatura aberta
  app.get('/api/cartoes', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const rows = await listarCartoesComResumo(resolveCartaoDataId(parsed, c))
      return c.json(rows)
    } catch (error) {
      log.error('listar cartões', error)
      return c.json({ message: error.message || 'Erro ao listar cartões.' }, 500)
    }
  })

  // GET /api/cartoes/:id/fatura?ref=YYYY-MM — fatura detalhada (antes das rotas /:id)
  app.get('/api/cartoes/:id/fatura', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Cartão inválido.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const fatura = await faturaDoCartao(resolveCartaoDataId(parsed, c), id, c.req.query('ref'))
      return c.json(fatura)
    } catch (error) {
      log.error('fatura cartão', error)
      return c.json({ message: error.message || 'Erro ao buscar fatura.' }, 400)
    }
  })

  // GET /api/cartoes/:id/transacoes?q= — busca no histórico completo do cartão
  app.get('/api/cartoes/:id/transacoes', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Cartão inválido.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const rows = await buscarTransacoesCartao(resolveCartaoDataId(parsed, c), id, c.req.query('q'))
      return c.json(rows)
    } catch (error) {
      log.error('buscar historico cartão', error)
      return c.json({ message: error.message || 'Erro ao buscar histórico.' }, 400)
    }
  })

  // GET /api/cartoes/:id/parceladas — compras parceladas ativas do cartão
  app.get('/api/cartoes/:id/parceladas', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Cartão inválido.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const rows = await listarParceladasCartao(resolveCartaoDataId(parsed, c), id)
      return c.json(rows)
    } catch (error) {
      log.error('listar parceladas cartão', error)
      return c.json({ message: error.message || 'Erro ao buscar parceladas.' }, 400)
    }
  })

  // POST /api/cartoes — criar
  app.post('/api/cartoes', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!rateLimitTake(`cartoes-create:${clientKeyFromHono(c)}`, 30, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um instante.' }, 429)
      }
      const body = await c.req.json().catch(() => ({}))
      const cartao = await criarCartao(resolveCartaoDataId(parsed, c), body)
      return c.json(cartao, 201)
    } catch (error) {
      log.error('criar cartão', error)
      return c.json({ message: error.message || 'Erro ao criar cartão.' }, 400)
    }
  })

  // PATCH /api/cartoes/:id — atualizar
  app.patch('/api/cartoes/:id', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Cartão inválido.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const body = await c.req.json().catch(() => ({}))
      const cartao = await atualizarCartao(resolveCartaoDataId(parsed, c), id, body)
      return c.json(cartao)
    } catch (error) {
      log.error('atualizar cartão', error)
      return c.json({ message: error.message || 'Erro ao atualizar cartão.' }, 400)
    }
  })

  // DELETE /api/cartoes/:id — excluir (desvincula transações via FK)
  app.delete('/api/cartoes/:id', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Cartão inválido.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      await excluirCartao(resolveCartaoDataId(parsed, c), id)
      return c.json({ ok: true })
    } catch (error) {
      log.error('excluir cartão', error)
      return c.json({ message: error.message || 'Erro ao excluir cartão.' }, 400)
    }
  })
}
