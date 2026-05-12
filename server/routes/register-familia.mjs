import { log } from '../lib/logger.mjs'
import { getSupabaseAdmin } from '../lib/supabase-admin.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import {
  aceitarConviteFamilia,
  alterarPapelMembro,
  buscarInfoConvitePorToken,
  criarConviteFamilia,
  hashFamiliaToken,
  listarConvitesPendentes,
  listarMembrosFamilia,
  removerMembroFamilia,
  resolveEscopoUsuario,
  revogarConviteFamilia,
  titularUsuarioIdParaGestaoFamilia,
} from '../lib/conta-familiar.mjs'

const MSG_GESTAO_FAMILIA = 'Apenas o titular da conta pode gerir convites e membros da família.'

function titularGestaoOu403(escopo) {
  const tid = titularUsuarioIdParaGestaoFamilia(escopo)
  return tid ? { ok: true, titularId: tid } : { ok: false }
}
import { isUuidString } from '../lib/transacao-validate.mjs'

export function registerFamiliaRoutes(app) {
  /** Público: validar token antes do login (sem dados sensíveis). */
  app.get('/api/familia/convite-info', async (c) => {
    try {
      const token = String(c.req.query('token') || '').trim()
      if (!token) return c.json({ message: 'Informe o token do convite.' }, 400)
      const ip = clientKeyFromHono(c)
      if (!rateLimitTake(`familia-convite-info:${ip}`, 40, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }
      if (!rateLimitTake(`familia-convite-token:${hashFamiliaToken(token)}`, 5, 300_000)) {
        return c.json({ message: 'Convite bloqueado temporariamente. Tente em alguns minutos.' }, 429)
      }
      const info = await buscarInfoConvitePorToken(token)
      return c.json(info)
    } catch (error) {
      log.error('familia convite-info', error)
      return c.json({ valido: false, motivo: 'Erro ao validar convite.' }, 500)
    }
  })

  app.post('/api/familia/convites', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const gestao = titularGestaoOu403(parsed.escopo)
      if (!gestao.ok) {
        return c.json({ message: 'Apenas o titular da conta pode criar convites.' }, 403)
      }

      if (!rateLimitTake(`familia-convite:${parsed.actorId}:${clientKeyFromHono(c)}`, 12, 86_400_000)) {
        return c.json({ message: 'Limite diário de convites atingido. Tente amanhã.' }, 429)
      }

      let body = {}
      try {
        body = await c.req.json()
      } catch {
        body = {}
      }
      const papel = String(body?.papel || 'MEMBER').toUpperCase()
      const label = body?.label ? String(body.label).slice(0, 60).trim() || null : null
      const criado = await criarConviteFamilia(gestao.titularId, papel, label)
      return c.json({
        message: 'Convite criado. Envie o link ou o código ao familiar — ele só aparece uma vez.',
        convite: criado.convite,
        token: criado.token_plain,
        validade_dias: criado.dias_validade,
      })
    } catch (error) {
      log.error('familia criar convite', error)
      return c.json({ message: error.message || 'Erro ao criar convite.' }, 400)
    }
  })

  app.get('/api/familia/convites', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const gestao = titularGestaoOu403(parsed.escopo)
      if (!gestao.ok) return c.json({ message: MSG_GESTAO_FAMILIA }, 403)
      const lista = await listarConvitesPendentes(gestao.titularId)
      return c.json({ convites: lista })
    } catch (error) {
      log.error('familia listar convites', error)
      return c.json({ message: 'Erro ao listar convites.' }, 500)
    }
  })

  app.delete('/api/familia/convites/:id', async (c) => {
    try {
      const id = c.req.param('id')
      if (!isUuidString(id)) return c.json({ message: 'ID inválido.' }, 400)
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const gestao = titularGestaoOu403(parsed.escopo)
      if (!gestao.ok) return c.json({ message: MSG_GESTAO_FAMILIA }, 403)
      await revogarConviteFamilia(gestao.titularId, id)
      return c.json({ message: 'Convite removido.' })
    } catch (error) {
      log.error('familia revogar convite', error)
      return c.json({ message: error.message || 'Erro ao remover convite.' }, 400)
    }
  })

  app.get('/api/familia/membros', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const gestao = titularGestaoOu403(parsed.escopo)
      if (!gestao.ok) return c.json({ message: MSG_GESTAO_FAMILIA }, 403)
      const membros = await listarMembrosFamilia(gestao.titularId)
      return c.json({ membros })
    } catch (error) {
      log.error('familia listar membros', error)
      return c.json({ message: 'Erro ao listar membros.' }, 500)
    }
  })

  app.patch('/api/familia/membros/:usuarioId', async (c) => {
    try {
      const membroId = c.req.param('usuarioId')
      if (!isUuidString(membroId)) return c.json({ message: 'ID inválido.' }, 400)
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const gestao = titularGestaoOu403(parsed.escopo)
      if (!gestao.ok) return c.json({ message: MSG_GESTAO_FAMILIA }, 403)
      let body = {}
      try { body = await c.req.json() } catch { return c.json({ message: 'JSON inválido.' }, 400) }
      const papel = String(body?.papel || '').toUpperCase()
      if (!papel) return c.json({ message: 'Informe o campo "papel" (ADMIN, MEMBER ou VIEWER).' }, 400)
      await alterarPapelMembro(gestao.titularId, membroId, papel)
      return c.json({ message: `Papel do membro atualizado para ${papel}.` })
    } catch (error) {
      log.error('familia alterar papel membro', error)
      return c.json({ message: error.message || 'Erro ao alterar papel.' }, 400)
    }
  })

  app.delete('/api/familia/membros/:usuarioId', async (c) => {
    try {
      const membroId = c.req.param('usuarioId')
      if (!isUuidString(membroId)) return c.json({ message: 'ID inválido.' }, 400)
      const usuarioId = c.req.header('x-user-id')
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const gestao = titularGestaoOu403(parsed.escopo)
      if (!gestao.ok) return c.json({ message: MSG_GESTAO_FAMILIA }, 403)
      await removerMembroFamilia(gestao.titularId, membroId)
      return c.json({ message: 'Membro removido da conta familiar.' })
    } catch (error) {
      log.error('familia remover membro', error)
      return c.json({ message: error.message || 'Erro ao remover.' }, 400)
    }
  })

  /** Membro remove o próprio vínculo (volta à conta só com seus dados). */
  app.post('/api/familia/sair', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      if (!rateLimitTake(`familia-sair:${usuarioId}`, 5, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }

      const escopo = await resolveEscopoUsuario(usuarioId)
      if (!escopo.isMembroConta) {
        return c.json({ message: 'Esta conta não está vinculada a uma família.' }, 400)
      }

      const supabase = getSupabaseAdmin()
      const { error } = await supabase
        .from('usuarios')
        .update({ vinculo_conta_principal_id: null, familia_papel: null })
        .eq('id', escopo.actorId)

      if (error) throw error

      const supabaseAudit = getSupabaseAdmin()
      await supabaseAudit.from('familia_audit_log').insert({
        titular_id: escopo.dataUsuarioId,
        actor_id: escopo.actorId,
        membro_id: escopo.actorId,
        acao: 'SAIU',
      }).catch(() => {})

      return c.json({ message: 'Você saiu da conta familiar. Seus dados próprios permanecem na sua conta.' })
    } catch (error) {
      log.error('familia sair', error)
      return c.json({ message: error.message || 'Erro ao sair.' }, 500)
    }
  })

  app.post('/api/familia/aceitar', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      let body = {}
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }
      const token = String(body?.token || '').trim()
      if (!token) return c.json({ message: 'Informe o token do convite.' }, 400)

      if (!rateLimitTake(`familia-aceitar:${usuarioId}:${clientKeyFromHono(c)}`, 20, 60_000)) {
        return c.json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429)
      }

      const resultado = await aceitarConviteFamilia(usuarioId, token)
      return c.json({
        message: 'Você entrou na conta familiar. Os dados financeiros e a agenda passam a ser os do titular.',
        titular_usuario_id: resultado.titular_usuario_id,
        familia_papel: resultado.familia_papel,
        conta_familiar_membro: true,
      })
    } catch (error) {
      log.error('familia aceitar', error)
      return c.json({ message: error.message || 'Não foi possível aceitar o convite.' }, 400)
    }
  })
}
