import { log } from '../lib/logger.mjs'
import { assertAgendaCronSecret } from '../lib/http/agenda-route-auth.mjs'
import { processDigestBatch } from '../lib/domain/digest-financeiro.mjs'
import {
  listarLimitesOrcamento,
  upsertLimiteOrcamento,
  removerLimiteOrcamento,
  getOrcamentosComGasto,
} from '../lib/domain/alertas-financeiros.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { isUuidString } from '../lib/transacao-validate.mjs'

export function registerDigestRoutes(app) {
  // GET /api/limites-orcamento — limites mensais por categoria (Orçado vs Real)
  app.get('/api/limites-orcamento', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const pessoal = c.req.query('pessoal')
      const dataId = pessoal === '1' ? parsed.actorId : parsed.dataUsuarioId
      const rows = await listarLimitesOrcamento(dataId)
      return c.json(Array.isArray(rows) ? rows : [])
    } catch (error) {
      log.error('listar limites orcamento', error)
      return c.json({ message: 'Erro ao listar limites de orçamento.' }, 500)
    }
  })

  // GET /api/limites-orcamento/status — limite + gasto do mês por categoria orçada.
  app.get('/api/limites-orcamento/status', async (c) => {
    try {
      const parsed = await parseUsuarioEscopoApi(resolveRequestUserId(c), { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const dataId = c.req.query('pessoal') === '1' ? parsed.actorId : parsed.dataUsuarioId
      return c.json(await getOrcamentosComGasto(dataId))
    } catch (error) {
      log.error('status orcamentos', error)
      return c.json({ message: 'Erro ao calcular orçamentos.' }, 500)
    }
  })

  // POST /api/limites-orcamento — define/atualiza (upsert) o limite mensal.
  app.post('/api/limites-orcamento', async (c) => {
    try {
      const parsed = await parseUsuarioEscopoApi(resolveRequestUserId(c), { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      if (!await rateLimitTake(`orc-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 60, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }
      let body = {}
      try { body = await c.req.json() } catch { body = {} }
      const categoriaId = String(body?.categoria_id || '').trim()
      const limite = Number(body?.limite_mensal)
      if (!isUuidString(categoriaId)) return c.json({ message: 'Categoria inválida.' }, 400)
      if (!Number.isFinite(limite) || limite <= 0) return c.json({ message: 'Informe um limite maior que zero.' }, 400)
      await upsertLimiteOrcamento(parsed.dataUsuarioId, categoriaId, Math.round(limite * 100) / 100)
      return c.json({ categoria_id: categoriaId, limite_mensal: Math.round(limite * 100) / 100 })
    } catch (error) {
      log.error('upsert limite orcamento', error)
      return c.json({ message: 'Erro ao salvar orçamento.' }, 500)
    }
  })

  // DELETE /api/limites-orcamento/:categoriaId — remove o limite.
  app.delete('/api/limites-orcamento/:categoriaId', async (c) => {
    try {
      const parsed = await parseUsuarioEscopoApi(resolveRequestUserId(c), { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)
      const categoriaId = c.req.param('categoriaId')
      if (!isUuidString(categoriaId)) return c.json({ message: 'Categoria inválida.' }, 400)
      await removerLimiteOrcamento(parsed.dataUsuarioId, categoriaId)
      return c.json({ ok: true })
    } catch (error) {
      log.error('remover limite orcamento', error)
      return c.json({ message: 'Erro ao remover orçamento.' }, 500)
    }
  })

  app.get('/api/cron/digest-semanal', async (c) => {
    const auth = assertAgendaCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)

    try {
      const result = await processDigestBatch({ tipo: 'semanal' })
      log.info('[digest-cron] semanal processed', result)
      return c.json(result)
    } catch (error) {
      log.error('cron digest semanal', error)
      return c.json({ message: 'Erro no digest semanal.' }, 500)
    }
  })

  app.get('/api/cron/digest-mensal', async (c) => {
    const auth = assertAgendaCronSecret(c)
    if (!auth.ok) return c.json({ message: auth.message }, auth.status)

    try {
      const result = await processDigestBatch({ tipo: 'mensal' })
      log.info('[digest-cron] mensal processed', result)
      return c.json(result)
    } catch (error) {
      log.error('cron digest mensal', error)
      return c.json({ message: 'Erro no digest mensal.' }, 500)
    }
  })
}
