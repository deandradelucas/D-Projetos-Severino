import { log } from '../lib/logger.mjs'
import { clientIpFromHono } from '../lib/http/client-ip.mjs'
import { assertAcessoAppUsuario } from '../lib/assinatura.mjs'
import {
  getCategorias,
  getTransacoes,
  atualizarTransacao,
  deletarTransacao,
} from '../lib/transacoes.mjs'
import {
  assertCronSecret,
  desativarRecorrenciaMensal,
  listarRecorrenciasMensais,
  processarRecorrenciasPendentes,
} from '../lib/recorrencias-mensais.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import {
  validateNovaTransacaoBody,
  validateAtualizacaoTransacaoBody,
  validateTransacoesListQuery,
  isUuidString,
} from '../lib/transacao-validate.mjs'
import { TransactionService } from '../lib/services/transaction-service.mjs'

export function registerTransacoesRoutes(app) {
  app.get('/api/categorias', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      const data = await getCategorias(usuarioId)
      return c.json(data)
    } catch (error) {
      log.error('get categories failed', error)
      return c.json({ message: 'Erro ao buscar categorias.' }, 500)
    }
  })

  app.get('/api/transacoes', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      const listQ = validateTransacoesListQuery({
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
      })
      if (!listQ.ok) {
        return c.json({ message: listQ.message }, 400)
      }

      const ip = clientIpFromHono(c)
      if (!rateLimitTake(`tx-list:${usuarioId}:${ip}`, 240, 60_000)) {
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
        limit: c.req.query('limit') ? parseInt(c.req.query('limit')) : undefined,
        offset: qOff !== undefined && qOff !== '' ? parseInt(String(qOff), 10) : undefined,
      }

      const data = await getTransacoes(usuarioId, filters)
      return c.json(data)
    } catch (error) {
      log.error('get transactions failed', error)
      return c.json({ message: 'Erro ao buscar transações.' }, 500)
    }
  })

  app.post('/api/transacoes', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      if (!rateLimitTake(`tx-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
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

      const data = await TransactionService.createTransaction(usuarioId, body)

      return c.json({ message: 'Transação inserida com sucesso.', data }, 201)
    } catch (error) {
      log.error('insert transaction failed', error)
      return c.json({ message: error.message || 'Erro ao inserir transação.' }, 500)
    }
  })

  app.post('/api/recorrencias-mensais/sincronizar', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      const result = await processarRecorrenciasPendentes(usuarioId)
      return c.json(result)
    } catch (error) {
      log.error('sincronizar recorrências mensais', error)
      return c.json({ message: error.message || 'Erro ao sincronizar.' }, 500)
    }
  })

  app.get('/api/recorrencias-mensais', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      const data = await listarRecorrenciasMensais(usuarioId)
      return c.json(data)
    } catch (error) {
      log.error('listar recorrências mensais', error)
      return c.json({ message: error.message || 'Erro ao listar.' }, 500)
    }
  })

  app.delete('/api/recorrencias-mensais/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      await desativarRecorrenciaMensal(id, usuarioId)
      return c.json({ message: 'Recorrência encerrada.' })
    } catch (error) {
      log.error('desativar recorrência mensal', error)
      return c.json({ message: error.message || 'Erro ao encerrar.' }, 500)
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
      return c.json({ message: error.message || 'Erro no cron.' }, 500)
    }
  })

  app.put('/api/transacoes/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      if (!isUuidString(id)) {
        return c.json({ message: 'ID inválido.' }, 400)
      }

      if (!rateLimitTake(`tx-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
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

      await atualizarTransacao(id, usuarioId, body)
      return c.json({ message: 'Transação atualizada com sucesso.' })
    } catch (error) {
      log.error('update transaction failed', error)
      return c.json({ message: error.message || 'Erro ao atualizar transação.' }, 500)
    }
  })

  app.delete('/api/transacoes/:id', async (c) => {
    try {
      const id = c.req.param('id')
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      if (!isUuidString(id)) {
        return c.json({ message: 'ID inválido.' }, 400)
      }

      if (!rateLimitTake(`tx-mut:${usuarioId}:${clientKeyFromHono(c)}`, 90, 60_000)) {
        return c.json({ message: 'Muitas alterações. Aguarde um momento.' }, 429)
      }

      await deletarTransacao(id, usuarioId)
      return c.json({ message: 'Transação excluída com sucesso.' })
    } catch (error) {
      log.error('delete transaction failed', error)
      return c.json({ message: 'Erro ao excluir transação.' }, 500)
    }
  })
}
