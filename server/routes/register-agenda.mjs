import { log } from '../lib/logger.mjs'
import {
  atualizarAgendaEvento,
  atualizarAgendaStatus,
  criarAgendaEvento,
  deletarAgendaEvento,
  listarAgendaEventos,
} from '../lib/domain/agenda.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
import { assertAgendaCronSecret } from '../lib/http/agenda-route-auth.mjs'
import { processAgendaReminderCron } from '../lib/domain/agenda-reminder-cron.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

export function registerAgendaRoutes(app) {
  app.get('/api/agenda', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const data = await listarAgendaEventos(parsed.dataUsuarioId, {
        from: c.req.query('from'),
        to: c.req.query('to'),
        status: c.req.query('status'),
        incluirCancelados: c.req.query('incluirCancelados') === '1',
      })
      return c.json(data)
    } catch (error) {
      log.error('listar agenda', error)
      return c.json({ message: error.message || 'Erro ao listar agenda.' }, 500)
    }
  })

  app.post('/api/agenda', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!rateLimitTake(`agenda-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await criarAgendaEvento(parsed.dataUsuarioId, body, 'APP')
      return c.json({ message: 'Compromisso criado.', data }, 201)
    } catch (error) {
      log.error('criar agenda', error)
      return c.json({ message: error.message || 'Erro ao criar compromisso.' }, 500)
    }
  })

  app.put('/api/agenda/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      if (!rateLimitTake(`agenda-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await atualizarAgendaEvento(id, parsed.dataUsuarioId, body)
      return c.json({ message: 'Compromisso atualizado.', data })
    } catch (error) {
      log.error('atualizar agenda', error)
      return c.json({ message: error.message || 'Erro ao atualizar compromisso.' }, 500)
    }
  })

  app.patch('/api/agenda/:id/status', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await atualizarAgendaStatus(id, parsed.dataUsuarioId, body?.status)
      return c.json({ message: 'Status atualizado.', data })
    } catch (error) {
      log.error('status agenda', error)
      return c.json({ message: error.message || 'Erro ao atualizar status.' }, 500)
    }
  })

  app.delete('/api/agenda/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      await deletarAgendaEvento(id, parsed.dataUsuarioId)
      return c.json({ message: 'Compromisso removido.' })
    } catch (error) {
      log.error('remover agenda', error)
      return c.json({ message: error.message || 'Erro ao remover compromisso.' }, 500)
    }
  })

  app.get('/api/cron/agenda-lembretes', async (c) => {
    const auth = assertAgendaCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)

    try {
      const result = await processAgendaReminderCron({ limit: 80 })
      log.info('[agenda-cron] processed reminders', result)
      return c.json(result)
    } catch (error) {
      log.error('cron agenda lembretes', error)
      return c.json({ message: error.message || 'Erro no cron de lembretes.' }, 500)
    }
  })
}
