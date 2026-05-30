import { log } from '../lib/logger.mjs'
import { getSupabaseAdmin } from '../lib/supabase-admin.mjs'
import { assertPrincipalAdmin } from '../lib/admin/assert-principal-admin.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

export function registerFrameworkRoutes(app) {
  /** Lista propostas do @aprendizdaagenda com filtro de status */
  app.get('/api/admin/framework/propostas', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const status = c.req.query('status') || 'pendente'
      const supabase = getSupabaseAdmin()

      let query = supabase
        .from('agenda_learning_proposals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (status === 'pendente') {
        query = query.is('aprovacao', null)
      } else if (status === 'aprovado') {
        query = query.eq('aprovacao', true)
      } else if (status === 'rejeitado') {
        query = query.eq('aprovacao', false)
      }

      const { data, error } = await query
      if (error) throw error
      return c.json(data ?? [])
    } catch (error) {
      log.error('listar propostas framework', error)
      return c.json({ message: 'Erro ao carregar propostas.' }, 500)
    }
  })

  /** Aprovar ou rejeitar uma proposta */
  app.patch('/api/admin/framework/propostas/:id/revisar', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const { id } = c.req.param()
      const body = await c.req.json().catch(() => null)
      if (!body || typeof body.aprovacao !== 'boolean') {
        return c.json({ message: 'Campo "aprovacao" (boolean) obrigatório.' }, 400)
      }

      const supabase = getSupabaseAdmin()

      const { data: proposal, error: fetchErr } = await supabase
        .from('agenda_learning_proposals')
        .select('id, aprovacao, alteracao_tipo, alteracao_conteudo')
        .eq('id', id)
        .single()

      if (fetchErr || !proposal) return c.json({ message: 'Proposta não encontrada.' }, 404)
      if (proposal.aprovacao !== null) return c.json({ message: 'Proposta já revisada.' }, 409)

      const { error: updateErr } = await supabase
        .from('agenda_learning_proposals')
        .update({ aprovacao: body.aprovacao, revisado_em: new Date().toISOString(), revisado_por: usuarioId })
        .eq('id', id)

      if (updateErr) throw updateErr

      // Se aprovado e tipo prompt_regra → ativar regra no banco
      if (body.aprovacao && proposal.alteracao_tipo === 'prompt_regra') {
        const conteudo = proposal.alteracao_conteudo ?? {}
        const regraTex = conteudo.regra_nova ?? conteudo.after ?? ''
        if (regraTex) {
          await supabase.from('agenda_learned_rules').insert({
            proposal_id: id,
            descricao: conteudo.descricao ?? 'Regra aprovada',
            regra_texto: regraTex,
          })
          await supabase
            .from('agenda_learning_proposals')
            .update({ aplicado: true })
            .eq('id', id)
        }
      }

      return c.json({ ok: true })
    } catch (error) {
      log.error('revisar proposta framework', error)
      return c.json({ message: 'Erro ao revisar proposta.' }, 500)
    }
  })

  /** Contagens por status (para badges nos tabs) */
  app.get('/api/admin/framework/propostas/contagem', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const block = await assertPrincipalAdmin(usuarioId)
      if (block) return c.json({ message: block.message }, block.status)

      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase
        .from('agenda_learning_proposals')
        .select('aprovacao')

      if (error) throw error

      const rows = data ?? []
      return c.json({
        pendente: rows.filter((r) => r.aprovacao === null).length,
        aprovado: rows.filter((r) => r.aprovacao === true).length,
        rejeitado: rows.filter((r) => r.aprovacao === false).length,
      })
    } catch (error) {
      log.error('contagem propostas framework', error)
      return c.json({ message: 'Erro ao contar propostas.' }, 500)
    }
  })
}
