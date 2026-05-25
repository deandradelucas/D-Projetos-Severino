import { log } from '../lib/logger.mjs'
import {
  listarListasUsuario,
  criarLista,
  atualizarLista,
  arquivarLista,
  listarItensLista,
  criarItem,
  atualizarItem,
  toggleChecked,
  removerItem,
  listarHistoricoNomes,
  listarListasArquivadas,
} from '../lib/lista-compras.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

export function registerListaComprasRoutes(app) {
  // GET /api/lista-compras — listar listas ativas com itens
  app.get('/api/lista-compras', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const rows = await listarListasUsuario(parsed.dataUsuarioId)
      return c.json(rows)
    } catch (error) {
      log.error('listar listas de compras', error)
      return c.json({ message: error.message || 'Erro ao listar listas.' }, 500)
    }
  })

  // GET /api/lista-compras/historico-nomes — autocomplete (antes das rotas /:id)
  app.get('/api/lista-compras/historico-nomes', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const q = c.req.query('q') || ''
      const nomes = await listarHistoricoNomes(parsed.dataUsuarioId, 50)

      const filtrados = q.trim().length >= 1
        ? nomes.filter((n) => n.toLowerCase().includes(q.toLowerCase()))
        : nomes

      return c.json(filtrados.slice(0, 30))
    } catch (error) {
      log.error('historico nomes lista compras', error)
      return c.json({ message: error.message || 'Erro ao buscar histórico.' }, 500)
    }
  })

  // GET /api/lista-compras/arquivadas
  app.get('/api/lista-compras/arquivadas', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const rows = await listarListasArquivadas(parsed.dataUsuarioId)
      return c.json(rows)
    } catch (error) {
      log.error('listar listas arquivadas', error)
      return c.json({ message: error.message || 'Erro ao listar arquivadas.' }, 500)
    }
  })

  // POST /api/lista-compras — criar lista
  app.post('/api/lista-compras', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!await rateLimitTake(`lista-compras-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await criarLista(parsed.dataUsuarioId, body)
      return c.json(data, 201)
    } catch (error) {
      log.error('criar lista de compras', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('inválido') || domMsg.includes('caracteres') ? 400 : 500
      return c.json({ message: status === 400 ? domMsg : 'Erro ao criar lista.' }, status)
    }
  })

  // PATCH /api/lista-compras/:id — atualizar lista
  app.patch('/api/lista-compras/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`lista-compras-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await atualizarLista(id, parsed.dataUsuarioId, body)
      return c.json(data)
    } catch (error) {
      log.error('atualizar lista de compras', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrada') ? 404
        : domMsg.includes('inválido') || domMsg.includes('Nenhum') ? 400
        : 500
      return c.json({ message: status === 500 ? 'Erro ao atualizar lista.' : domMsg }, status)
    }
  })

  // DELETE /api/lista-compras/:id — arquivar lista
  app.delete('/api/lista-compras/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`lista-compras-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      await arquivarLista(id, parsed.dataUsuarioId)
      return c.json({ message: 'Lista arquivada.' })
    } catch (error) {
      log.error('arquivar lista de compras', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrada') ? 404 : 500
      return c.json({ message: status === 500 ? 'Erro ao arquivar lista.' : domMsg }, status)
    }
  })

  // GET /api/lista-compras/:id/itens — listar itens da lista
  app.get('/api/lista-compras/:id/itens', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      const rows = await listarItensLista(id, parsed.dataUsuarioId)
      return c.json(rows)
    } catch (error) {
      log.error('listar itens lista compras', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrada') ? 404 : 500
      return c.json({ message: status === 500 ? 'Erro ao listar itens.' : domMsg }, status)
    }
  })

  // POST /api/lista-compras/:id/itens — criar item
  app.post('/api/lista-compras/:id/itens', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`lista-compras-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await criarItem(id, parsed.dataUsuarioId, body)
      return c.json(data, 201)
    } catch (error) {
      log.error('criar item lista compras', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrada') ? 404
        : domMsg.includes('inválido') || domMsg.includes('caracteres') ? 400
        : 500
      return c.json({ message: status === 500 ? 'Erro ao criar item.' : domMsg }, status)
    }
  })

  // PATCH /api/lista-compras/:id/itens/:itemId — atualizar item
  app.patch('/api/lista-compras/:id/itens/:itemId', async (c) => {
    try {
      const id = c.req.param('id')
      const itemId = c.req.param('itemId')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id) || !isUuidString(itemId)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`lista-compras-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await atualizarItem(itemId, id, parsed.dataUsuarioId, body)
      return c.json(data)
    } catch (error) {
      log.error('atualizar item lista compras', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrad') ? 404
        : domMsg.includes('inválid') || domMsg.includes('Nenhum') ? 400
        : 500
      return c.json({ message: status === 500 ? 'Erro ao atualizar item.' : domMsg }, status)
    }
  })

  // POST /api/lista-compras/:id/itens/:itemId/toggle — toggle checked
  app.post('/api/lista-compras/:id/itens/:itemId/toggle', async (c) => {
    try {
      const id = c.req.param('id')
      const itemId = c.req.param('itemId')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id) || !isUuidString(itemId)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`lista-compras-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      const data = await toggleChecked(itemId, id, parsed.dataUsuarioId)
      return c.json(data)
    } catch (error) {
      log.error('toggle item lista compras', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrad') ? 404 : 500
      return c.json({ message: status === 500 ? 'Erro ao atualizar item.' : domMsg }, status)
    }
  })

  // DELETE /api/lista-compras/:id/itens/:itemId — remover item
  app.delete('/api/lista-compras/:id/itens/:itemId', async (c) => {
    try {
      const id = c.req.param('id')
      const itemId = c.req.param('itemId')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id) || !isUuidString(itemId)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`lista-compras-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      await removerItem(itemId, id, parsed.dataUsuarioId)
      return c.json({ message: 'Item removido.' })
    } catch (error) {
      log.error('remover item lista compras', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrad') ? 404 : 500
      return c.json({ message: status === 500 ? 'Erro ao remover item.' : domMsg }, status)
    }
  })
}
