import { log } from '../lib/logger.mjs'
import {
  atualizarInvestimentoUsuario,
  criarAporteInvestimento,
  criarInvestimentoUsuario,
  listarInvestimentosUsuario,
  removerAporteInvestimento,
  removerInvestimentoUsuario,
} from '../lib/investimentos.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

export function registerInvestimentosRoutes(app) {
  app.get('/api/investimentos', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const rows = await listarInvestimentosUsuario(parsed.dataUsuarioId)
      return c.json(rows)
    } catch (error) {
      log.error('listar investimentos', error)
      return c.json({ message: error.message || 'Erro ao listar investimentos.' }, 500)
    }
  })

  app.post('/api/investimentos', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!await rateLimitTake(`investimentos-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await criarInvestimentoUsuario(parsed.dataUsuarioId, body)
      return c.json(data, 201)
    } catch (error) {
      log.error('criar investimento', error)
      const domMsg = error.message || ''
      const status =
        domMsg.includes('mínimo') ||
        domMsg.includes('lista') ||
        domMsg.includes('banco') ||
        domMsg.includes('corretora') ||
        domMsg.includes('valor') ||
        domMsg.includes('Percentual') ||
        domMsg.includes('CDI') ||
        domMsg.includes('aquisição')
          ? 400
          : 500
      const msg = status === 500 ? 'Erro ao criar investimento.' : (domMsg || 'Erro ao criar investimento.')
      return c.json({ message: msg }, status)
    }
  })

  app.patch('/api/investimentos/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`investimentos-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await atualizarInvestimentoUsuario(id, parsed.dataUsuarioId, body)
      return c.json(data)
    } catch (error) {
      log.error('atualizar investimento', error)
      const domMsg = error.message || ''
      const status =
        domMsg.includes('não encontrado')
          ? 404
          : domMsg.includes('mínimo') ||
              domMsg.includes('lista') ||
              domMsg.includes('banco') ||
              domMsg.includes('corretora') ||
              domMsg.includes('valor') ||
              domMsg.includes('Percentual') ||
              domMsg.includes('CDI') ||
              domMsg.includes('aquisição')
            ? 400
            : 500
      const msg = status === 500 ? 'Erro ao atualizar investimento.' : (domMsg || 'Erro ao atualizar investimento.')
      return c.json({ message: msg }, status)
    }
  })

  app.delete('/api/investimentos/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`investimentos-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      await removerInvestimentoUsuario(id, parsed.dataUsuarioId)
      return c.json({ message: 'Removido.' })
    } catch (error) {
      log.error('remover investimento', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrado') ? 404 : 500
      const msg = status === 500 ? 'Erro ao remover investimento.' : (domMsg || 'Erro ao remover investimento.')
      return c.json({ message: msg }, status)
    }
  })

  // POST /api/investimentos/:id/aportes
  app.post('/api/investimentos/:id/aportes', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`investimentos-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await criarAporteInvestimento(id, parsed.dataUsuarioId, body)
      return c.json(data, 201)
    } catch (error) {
      log.error('criar aporte', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrado')
        ? 404
        : domMsg.includes('mínimo') || domMsg.includes('valor') || domMsg.includes('aquisição')
          ? 400
          : 500
      const msg = status === 500 ? 'Erro ao criar aporte.' : (domMsg || 'Erro ao criar aporte.')
      return c.json({ message: msg }, status)
    }
  })

  // DELETE /api/investimentos/:id/aportes/:aporteId
  app.delete('/api/investimentos/:id/aportes/:aporteId', async (c) => {
    try {
      const id = c.req.param('id')
      const aporteId = c.req.param('aporteId')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id) || !isUuidString(aporteId)) return c.json({ message: 'ID inválido.' }, 400)

      if (!await rateLimitTake(`investimentos-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      const data = await removerAporteInvestimento(aporteId, id, parsed.dataUsuarioId)
      return c.json(data)
    } catch (error) {
      log.error('remover aporte', error)
      const domMsg = error.message || ''
      const status = domMsg.includes('não encontrado')
        ? 404
        : domMsg.includes('único aporte')
          ? 409
          : 500
      const msg = status === 500 ? 'Erro ao remover aporte.' : (domMsg || 'Erro ao remover aporte.')
      return c.json({ message: msg }, status)
    }
  })
}
