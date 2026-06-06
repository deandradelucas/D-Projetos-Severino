import { log } from '../lib/logger.mjs'
import { clientIpFromHono } from '../lib/http/client-ip.mjs'
import {
  getCategorias,
  getTransacoes,
  atualizarTransacao,
  deletarTransacao,
  deletarGrupoParcelado,
  deletarTodasTransacoes,
} from '../lib/transacoes.mjs'
import {
  assertCronSecret,
  desativarRecorrenciaMensal,
  listarRecorrenciasMensais,
  processarRecorrenciasPendentes,
} from '../lib/recorrencias-mensais.mjs'
import { processarParcelasPendentes } from '../lib/parcelas-pendentes.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import {
  validateNovaTransacaoBody,
  validateAtualizacaoTransacaoBody,
  validateTransacoesListQuery,
  isUuidString,
} from '../lib/transacao-validate.mjs'
import { TransactionService } from '../lib/services/transaction-service.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'
import { getSupabaseAdmin } from '../lib/supabase-admin.mjs'
import { registrarCorrecaoCategoria } from '../lib/domain/transacao-categoria-logger.mjs'
import { getResumoMensal } from '../lib/relatorios-resumo.mjs'

export function registerTransacoesRoutes(app) {
  app.get('/api/categorias', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const data = await getCategorias(parsed.dataUsuarioId)
      return c.json(data)
    } catch (error) {
      log.error('get categories failed', error)
      return c.json({ message: 'Erro ao buscar categorias.' }, 500)
    }
  })

  app.get('/api/transacoes', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const listQ = validateTransacoesListQuery({
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
      })
      if (!listQ.ok) {
        return c.json({ message: listQ.message }, 400)
      }

      const ip = clientIpFromHono(c)
      if (!await rateLimitTake(`tx-list:${parsed.actorId}:${ip}`, 240, 60_000)) {
        return c.json({ message: 'Muitas consultas. Aguarde um momento.' }, 429)
      }

      const qOff = c.req.query('offset')
      const filters = {
        dataInicio: c.req.query('dataInicio'),
        dataFim: c.req.query('dataFim'),
        tipo: c.req.query('tipo'),
        categoria_id: c.req.query('categoria_id'),
        status: c.req.query('status'),
        busca: c.req.query('busca'),
        somenteRecorrentes: c.req.query('recorrentes') === '1',
        somenteParceladas: c.req.query('parceladas') === '1',
        limit: c.req.query('limit') ? parseInt(c.req.query('limit')) : undefined,
        offset: qOff !== undefined && qOff !== '' ? parseInt(String(qOff), 10) : undefined,
      }

      const data = await getTransacoes(parsed.dataUsuarioId, filters)
      return c.json(data)
    } catch (error) {
      log.error('get transactions failed', error)
      return c.json({ message: 'Erro ao buscar transações.' }, 500)
    }
  })

  // Resumo mensal agregado (linha do tempo histórica, independente do filtro de
  // período da tela de Relatórios). meses=12|24 (clamp 1..36 na lib).
  app.get('/api/relatorios/resumo-mensal', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const ip = clientIpFromHono(c)
      if (!await rateLimitTake(`rel-resumo:${parsed.actorId}:${ip}`, 60, 60_000)) {
        return c.json({ message: 'Muitas consultas. Aguarde um momento.' }, 429)
      }

      const mesesQ = parseInt(c.req.query('meses') || '24', 10)
      const meses = Number.isFinite(mesesQ) ? mesesQ : 24
      const data = await getResumoMensal(parsed.dataUsuarioId, { meses })
      return c.json(data)
    } catch (error) {
      log.error('get resumo-mensal failed', error)
      return c.json({ message: 'Erro ao buscar resumo mensal.' }, 500)
    }
  })

  app.post('/api/transacoes', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!await rateLimitTake(`tx-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const val = validateNovaTransacaoBody(body)
      if (!val.ok) {
        return c.json({ message: val.message }, 400)
      }

      const opts = { lancadoPorUsuarioId: parsed.actorId }

      if (body.parcelamento?.num_parcelas >= 2) {
        const data = await TransactionService.createParcelamento(parsed.dataUsuarioId, body, opts)
        return c.json({
          message: `${data.total_parcelas} parcelas registradas com sucesso.`,
          data,
        }, 201)
      }

      const data = await TransactionService.createTransaction(parsed.dataUsuarioId, body, opts)
      return c.json({ message: 'Transação inserida com sucesso.', data }, 201)
    } catch (error) {
      log.error('insert transaction failed', error)
      return c.json({ message: 'Erro ao inserir transação.' }, 500)
    }
  })

  app.post('/api/recorrencias-mensais/sincronizar', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const result = await processarRecorrenciasPendentes(parsed.dataUsuarioId)
      return c.json(result)
    } catch (error) {
      log.error('sincronizar recorrências mensais', error)
      return c.json({ message: 'Erro ao sincronizar.' }, 500)
    }
  })

  app.get('/api/recorrencias-mensais', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const data = await listarRecorrenciasMensais(parsed.dataUsuarioId)
      return c.json(data)
    } catch (error) {
      log.error('listar recorrências mensais', error)
      return c.json({ message: 'Erro ao listar.' }, 500)
    }
  })

  app.delete('/api/recorrencias-mensais/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      await desativarRecorrenciaMensal(id, parsed.dataUsuarioId)
      return c.json({ message: 'Recorrência encerrada.' })
    } catch (error) {
      log.error('desativar recorrência mensal', error)
      return c.json({ message: 'Erro ao encerrar.' }, 500)
    }
  })

  app.get('/api/cron/recorrencias-mensais', async (c) => {
    const auth = assertCronSecret(c)
    if (!auth.ok) {
      return c.json({ message: auth.message }, auth.status)
    }
    try {
      const result = await processarRecorrenciasPendentes(null)
      return c.json({ ok: true, ...result })
    } catch (error) {
      log.error('cron recorrências mensais', error)
      return c.json({ message: 'Erro no cron.' }, 500)
    }
  })

  app.get('/api/cron/parcelas-pendentes', async (c) => {
    const auth = assertCronSecret(c)
    if (!auth.ok) {
      return c.json({ message: auth.message }, auth.status)
    }
    try {
      const result = await processarParcelasPendentes()
      return c.json({ ok: true, ...result })
    } catch (error) {
      log.error('cron parcelas pendentes', error)
      return c.json({ message: 'Erro no cron.' }, 500)
    }
  })

  app.put('/api/transacoes/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!isUuidString(id)) {
        return c.json({ message: 'ID inválido.' }, 400)
      }

      if (!await rateLimitTake(`tx-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'JSON inválido.' }, 400)
      }

      const vBody = validateAtualizacaoTransacaoBody(body)
      if (!vBody.ok) {
        return c.json({ message: vBody.message }, 400)
      }

      // Estado anterior — para detectar correção de categoria (sinal de aprendizado)
      let catAntiga = null, descAntiga = null, tipoTx = null
      if (body.categoria_id) {
        try {
          const { data: old } = await getSupabaseAdmin()
            .from('transacoes').select('categoria_id, descricao, tipo').eq('id', id).maybeSingle()
          if (old) { catAntiga = old.categoria_id; descAntiga = old.descricao; tipoTx = old.tipo }
        } catch { /* noop */ }
      }

      await atualizarTransacao(id, parsed.dataUsuarioId, body)

      // Categoria mudou → registra (descrição → categoria) para o few-shot dinâmico
      if (body.categoria_id && catAntiga && body.categoria_id !== catAntiga) {
        const desc = (typeof body.descricao === 'string' && body.descricao.trim()) ? body.descricao : descAntiga
        registrarCorrecaoCategoria(parsed.actorId, body.categoria_id, desc, tipoTx).catch(() => {})
      }

      return c.json({ message: 'Transação atualizada com sucesso.' })
    } catch (error) {
      log.error('update transaction failed', error)
      return c.json({ message: 'Erro ao atualizar transação.' }, 500)
    }
  })

  app.delete('/api/transacoes/grupo/:grupoId', async (c) => {
    try {
      const grupoId = c.req.param('grupoId')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!isUuidString(grupoId)) {
        return c.json({ message: 'ID de grupo inválido.' }, 400)
      }

      if (!await rateLimitTake(`tx-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      await deletarGrupoParcelado(grupoId, parsed.dataUsuarioId)
      return c.json({ message: 'Compra parcelada excluída com sucesso.' })
    } catch (error) {
      log.error('delete grupo parcelado failed', error)
      return c.json({ message: 'Erro ao excluir compra parcelada.' }, 500)
    }
  })

  app.delete('/api/transacoes', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!await rateLimitTake(`tx-del-all:${parsed.actorId}:${clientKeyFromHono(c)}`, 3, 60_000)) {
        return c.json({ message: 'Muitas solicitações. Aguarde um momento.' }, 429)
      }

      await deletarTodasTransacoes(parsed.dataUsuarioId)
      return c.json({ message: 'Todas as transações foram excluídas.' })
    } catch (error) {
      log.error('delete all transactions failed', error)
      return c.json({ message: 'Erro ao excluir transações.' }, 500)
    }
  })

  app.delete('/api/transacoes/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!isUuidString(id)) {
        return c.json({ message: 'ID inválido.' }, 400)
      }

      if (!await rateLimitTake(`tx-mut:${parsed.actorId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      await deletarTransacao(id, parsed.dataUsuarioId)
      return c.json({ message: 'Transação excluída com sucesso.' })
    } catch (error) {
      log.error('delete transaction failed', error)
      return c.json({ message: 'Erro ao excluir transação.' }, 500)
    }
  })
}
