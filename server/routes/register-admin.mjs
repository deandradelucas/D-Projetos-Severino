import { log } from '../lib/logger.mjs'
import { clientIpFromHono } from '../lib/http/client-ip.mjs'
import { isMercadoPagoConfigured } from '../lib/mercadopago.mjs'
import {
  listUsuariosAdminPaged,
  updateUsuarioAdmin,
  deleteUsuarioAdmin,
  getPerfilUsuario,
} from '../lib/usuarios.mjs'
import { insertAdminAuditLog, listAdminAuditLog } from '../lib/admin-audit.mjs'
import {
  listPagamentosAdminPayload,
  deletePagamentosPendentesAdmin,
} from '../lib/pagamentos-mp.mjs'
import { requestPasswordOtpWhatsApp } from '../lib/password-otp-whatsapp.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { mapSupabaseOrNetworkError } from '../lib/http/hono-error-map.mjs'
import { assertPrincipalAdmin } from '../lib/admin/assert-principal-admin.mjs'

export function registerAdminRoutes(app) {
  /** Painel interno: token MP configurado e path do webhook (sem segredos). */
  app.get('/api/admin/mp-saude', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)
      return c.json({
        mercado_pago_access_token_configured: isMercadoPagoConfigured(),
        webhook_get_post: '/api/pagamentos/webhook',
        nota:
          'No painel Mercado Pago, a URL de notificação deve apontar para este path e responder 200. Logs estruturados: svc=mercadopago-webhook no stdout.',
      })
    } catch (error) {
      log.error('mp-saude failed', error)
      return c.json({ message: 'Erro ao montar painel.' }, 500)
    }
  })

  app.get('/api/admin/usuarios', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const result = await listUsuariosAdminPaged({
        page: c.req.query('page'),
        pageSize: c.req.query('pageSize'),
        q: c.req.query('q'),
        role: c.req.query('role'),
        conta: c.req.query('conta'),
        assinatura: c.req.query('assinatura'),
        login: c.req.query('login'),
        createdFrom: c.req.query('createdFrom'),
        createdTo: c.req.query('createdTo'),
        accessFrom: c.req.query('accessFrom'),
        accessTo: c.req.query('accessTo'),
        payFrom: c.req.query('payFrom'),
        payTo: c.req.query('payTo'),
        trialEndsFrom: c.req.query('trialEndsFrom'),
        trialEndsTo: c.req.query('trialEndsTo'),
        sort: c.req.query('sort'),
      })
      return c.json(result)
    } catch (error) {
      log.error('get admin usuarios failed', error)
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Erro ao listar usuários.' }, 500)
    }
  })

  app.get('/api/admin/audit-log', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const lim = c.req.query('limit')
      const rows = await listAdminAuditLog(parseInt(lim || '100', 10) || 100)
      return c.json(rows)
    } catch (error) {
      log.error('get admin audit-log failed', error)
      return c.json({ message: 'Erro ao listar auditoria.' }, 500)
    }
  })

  app.put('/api/admin/usuarios/:id', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const id = c.req.param('id')
      const body = await c.req.json()
      const updated = await updateUsuarioAdmin(id, body || {}, {
        actorUserId: usuarioId,
        clientIp: clientIpFromHono(c),
      })
      return c.json(updated)
    } catch (error) {
      log.error('update admin usuario failed', error)
      if (error.statusCode === 403 || error.statusCode === 404) {
        return c.json({ message: error.message }, error.statusCode)
      }
      const msg = error.code === '23505' ? 'E-mail ou telefone já utilizado em outra conta.' : 'Erro ao atualizar usuário.'
      return c.json({ message: msg }, 500)
    }
  })

  app.get('/api/admin/pagamentos', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const lim = Math.min(800, Math.max(1, parseInt(c.req.query('limit') || '500', 10) || 500))
      const statusGroup = c.req.query('statusGroup') || 'all'
      const q = c.req.query('q') || ''
      const dateFrom = c.req.query('dateFrom') || ''
      const dateTo = c.req.query('dateTo') || ''
      const sort = c.req.query('sort') || 'created_desc'
      const exempt = c.req.query('exempt') || 'all'
      const overdueOnly = c.req.query('overdueOnly') || ''

      const payload = await listPagamentosAdminPayload({
        limit: lim,
        statusGroup,
        q,
        dateFrom,
        dateTo,
        sort,
        exempt,
        overdueOnly,
      })
      return c.json(payload)
    } catch (error) {
      log.error('get admin pagamentos failed', error)
      return c.json({ message: 'Erro ao listar pagamentos.' }, 500)
    }
  })

  app.delete('/api/admin/pagamentos/pendentes', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const { deleted } = await deletePagamentosPendentesAdmin()
      return c.json({
        deleted,
        message: deleted === 0 ? 'Nenhum registro pendente para excluir.' : `${deleted} registro(s) pendente(s) excluído(s).`,
      })
    } catch (error) {
      log.error('delete admin pagamentos pendentes failed', error)
      return c.json({ message: 'Erro ao excluir logs pendentes.' }, 500)
    }
  })

  app.delete('/api/admin/usuarios/:id', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const id = c.req.param('id')
      await deleteUsuarioAdmin(id, { actorUserId: usuarioId, clientIp: clientIpFromHono(c) })
      return c.json({ message: 'Usuário excluído com sucesso.' })
    } catch (error) {
      log.error('delete admin usuario failed', error)
      if (error.statusCode === 403) {
        return c.json({ message: error.message }, 403)
      }
      return c.json({ message: 'Erro ao excluir usuário.' }, 500)
    }
  })

  app.post('/api/admin/usuarios/:id/solicitar-otp-senha-whatsapp', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const id = c.req.param('id')
      const perfil = await getPerfilUsuario(id)
      if (!perfil?.email) return c.json({ message: 'Usuário não encontrado.' }, 404)

      const ip = clientKeyFromHono(c)
      if (!rateLimitTake(`admin-pw-otp:${usuarioId}:${ip}`, 25, 60 * 60_000)) {
        return c.json({ message: 'Limite de solicitações. Tente mais tarde.' }, 429)
      }

      const result = await requestPasswordOtpWhatsApp(perfil.email, { detailedErrors: true })
      await insertAdminAuditLog({
        actorUserId: usuarioId,
        action: 'reset_senha_otp_whatsapp',
        targetUserId: id,
        targetEmail: perfil.email,
        clientIp: clientIpFromHono(c),
      })
      return c.json({ message: result.message })
    } catch (error) {
      log.error('admin solicitar-otp-senha-whatsapp failed', error)
      const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
      if (status !== 500) {
        return c.json({ message: error.message || 'Solicitação inválida.' }, status)
      }
      const mapped = mapSupabaseOrNetworkError(error)
      if (mapped) return c.json({ message: mapped.message }, mapped.status)
      return c.json({ message: 'Erro ao solicitar código pelo WhatsApp.' }, 500)
    }
  })
}
