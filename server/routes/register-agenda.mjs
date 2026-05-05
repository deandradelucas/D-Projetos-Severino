import { log } from '../lib/logger.mjs'
import { assertAcessoAppUsuario } from '../lib/assinatura.mjs'
import {
  atualizarAgendaEvento,
  atualizarAgendaStatus,
  criarAgendaEvento,
  deletarAgendaEvento,
  listarAgendaEventos,
  listarEMarcarLembretesPendentes,
} from '../lib/domain/agenda.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'
import { assertAgendaReminderSecret, assertAgendaCronSecret } from '../lib/http/agenda-route-auth.mjs'
import { processAgendaReminderCron } from '../lib/domain/agenda-reminder-cron.mjs'

export function registerAgendaRoutes(app) {
  app.get('/api/agenda', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      const data = await listarAgendaEventos(usuarioId, {
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
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      if (!rateLimitTake(`agenda-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await criarAgendaEvento(usuarioId, body, 'APP')
      return c.json({ message: 'Compromisso criado.', data }, 201)
    } catch (error) {
      log.error('criar agenda', error)
      return c.json({ message: error.message || 'Erro ao criar compromisso.' }, 500)
    }
  })

  app.put('/api/agenda/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      if (!rateLimitTake(`agenda-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await atualizarAgendaEvento(id, usuarioId, body)
      return c.json({ message: 'Compromisso atualizado.', data })
    } catch (error) {
      log.error('atualizar agenda', error)
      return c.json({ message: error.message || 'Erro ao atualizar compromisso.' }, 500)
    }
  })

  app.patch('/api/agenda/:id/status', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const data = await atualizarAgendaStatus(id, usuarioId, body?.status)
      return c.json({ message: 'Status atualizado.', data })
    } catch (error) {
      log.error('status agenda', error)
      return c.json({ message: error.message || 'Erro ao atualizar status.' }, 500)
    }
  })

  app.delete('/api/agenda/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      await deletarAgendaEvento(id, usuarioId)
      return c.json({ message: 'Compromisso removido.' })
    } catch (error) {
      log.error('remover agenda', error)
      return c.json({ message: error.message || 'Erro ao remover compromisso.' }, 500)
    }
  })

  app.post('/api/agenda/lembretes/pendentes', async (c) => {
    const auth = assertAgendaReminderSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)

    try {
      let body = {}
      try {
        body = await c.req.json()
      } catch {
        body = {}
      }
      const result = await listarEMarcarLembretesPendentes({
        limit: body?.limit,
        janelaMinutos: body?.janelaMinutos,
      })
      return c.json(result)
    } catch (error) {
      log.error('agenda lembretes pendentes', error)
      return c.json({ message: error.message || 'Erro ao buscar lembretes.' }, 500)
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
