import { log } from '../lib/logger.mjs'
import {
  listarMetas,
  criarMeta,
  atualizarMeta,
  excluirMeta,
  adicionarAporte,
  listarAportes,
} from '../lib/metas.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

/** Resolve o usuário-dono dos dados: pessoal=1 → próprio; senão titular da família. */
function resolveMetaDataId(parsed, c) {
  return c.req.query('pessoal') === '1' ? parsed.actorId : parsed.dataUsuarioId
}

export function registerMetasRoutes(app) {
  // GET /api/metas — listar metas ativas
  app.get('/api/metas', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const rows = await listarMetas(resolveMetaDataId(parsed, c))
      return c.json(rows)
    } catch (error) {
      log.error('listar metas', error)
      return c.json({ message: error.message || 'Erro ao listar metas.' }, 500)
    }
  })

  // POST /api/metas — criar meta
  app.post('/api/metas', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!rateLimitTake(`metas-create:${clientKeyFromHono(c)}`, 30, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um instante.' }, 429)
      }
      const body = await c.req.json().catch(() => ({}))
      const meta = await criarMeta(resolveMetaDataId(parsed, c), body)
      return c.json(meta, 201)
    } catch (error) {
      log.error('criar meta', error)
      return c.json({ message: error.message || 'Erro ao criar meta.' }, 400)
    }
  })

  // PATCH /api/metas/:id — atualizar meta
  app.patch('/api/metas/:id', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Meta inválida.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const body = await c.req.json().catch(() => ({}))
      const meta = await atualizarMeta(resolveMetaDataId(parsed, c), id, body)
      return c.json(meta)
    } catch (error) {
      log.error('atualizar meta', error)
      return c.json({ message: error.message || 'Erro ao atualizar meta.' }, 400)
    }
  })

  // DELETE /api/metas/:id — excluir meta
  app.delete('/api/metas/:id', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Meta inválida.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      await excluirMeta(resolveMetaDataId(parsed, c), id)
      return c.json({ ok: true })
    } catch (error) {
      log.error('excluir meta', error)
      return c.json({ message: error.message || 'Erro ao excluir meta.' }, 400)
    }
  })

  // POST /api/metas/:id/aportes — guardar/resgatar valor
  app.post('/api/metas/:id/aportes', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Meta inválida.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!rateLimitTake(`metas-aporte:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um instante.' }, 429)
      }
      const body = await c.req.json().catch(() => ({}))
      const meta = await adicionarAporte(resolveMetaDataId(parsed, c), id, body.valor, body.nota)
      return c.json(meta)
    } catch (error) {
      log.error('aporte meta', error)
      return c.json({ message: error.message || 'Erro ao registrar aporte.' }, 400)
    }
  })

  // GET /api/metas/:id/aportes — histórico de aportes
  app.get('/api/metas/:id/aportes', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'Meta inválida.' }, 400)
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const rows = await listarAportes(resolveMetaDataId(parsed, c), id)
      return c.json(rows)
    } catch (error) {
      log.error('listar aportes meta', error)
      return c.json({ message: error.message || 'Erro ao listar aportes.' }, 500)
    }
  })
}
