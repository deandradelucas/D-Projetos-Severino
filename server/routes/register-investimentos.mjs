import { log } from '../lib/logger.mjs'
import {
  atualizarInvestimentoUsuario,
  criarInvestimentoUsuario,
  listarInvestimentosUsuario,
  removerInvestimentoUsuario,
} from '../lib/investimentos.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'

export function registerInvestimentosRoutes(app) {
  app.get('/api/investimentos', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
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
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!rateLimitTake(`investimentos-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
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
      const msg = error.message || 'Erro ao criar investimento.'
      const status =
        msg.includes('mínimo') ||
        msg.includes('lista') ||
        msg.includes('banco') ||
        msg.includes('corretora') ||
        msg.includes('valor') ||
        msg.includes('Percentual') ||
        msg.includes('CDI') ||
        msg.includes('aquisição')
          ? 400
          : 500
      return c.json({ message: msg }, status)
    }
  })

  app.patch('/api/investimentos/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!rateLimitTake(`investimentos-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
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
      const msg = error.message || 'Erro ao atualizar investimento.'
      const status =
        msg.includes('não encontrado')
          ? 404
          : msg.includes('mínimo') ||
              msg.includes('lista') ||
              msg.includes('banco') ||
              msg.includes('corretora') ||
              msg.includes('valor') ||
              msg.includes('Percentual') ||
              msg.includes('CDI') ||
              msg.includes('aquisição')
            ? 400
            : 500
      return c.json({ message: msg }, status)
    }
  })

  app.delete('/api/investimentos/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!rateLimitTake(`investimentos-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      await removerInvestimentoUsuario(id, parsed.dataUsuarioId)
      return c.json({ message: 'Removido.' })
    } catch (error) {
      log.error('remover investimento', error)
      const msg = error.message || 'Erro ao remover investimento.'
      const status = msg.includes('não encontrado') ? 404 : 500
      return c.json({ message: msg }, status)
    }
  })
}
