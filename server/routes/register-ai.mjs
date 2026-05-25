import { log } from '../lib/logger.mjs'
import { Alerts } from '../lib/notify-telegram.mjs'
import {
  askHorizon,
  suggestCategoryForTransaction,
} from '../lib/ai.mjs'
import { getCategorias } from '../lib/transacoes.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

export function registerAiRoutes(app) {
  app.post('/api/ai/chat', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      const body = await c.req.json()
      const message = String(body?.message || '').trim()
      const historico = Array.isArray(body?.historico) ? body.historico : []

      if (!message) {
        return c.json({ message: 'Mensagem não pode estar vazia.' }, 400)
      }

      if (!await rateLimitTake(`ai-chat:${parsed.actorId}:${clientKeyFromHono(c)}`, 40, 60_000)) {
        return c.json({ message: 'Muitas mensagens seguidas. Aguarde cerca de um minuto e tente de novo.' }, 429)
      }

      const resposta = await askHorizon(message, parsed.dataUsuarioId, historico)

      return c.json({ resposta })
    } catch (error) {
      log.error('ai chat failed', error)
      const raw = String(error?.message || '')
      if (raw.includes('GEMINI_API_KEY') || /GEMINI_API_KEY não configurada/i.test(raw)) {
        return c.json(
          {
            message:
              'Chave de API do Gemini não configurada. Adicione GEMINI_API_KEY no .env do servidor.',
          },
          500,
        )
      }
      if (raw.includes('filtro de segurança')) {
        return c.json({ message: raw }, 422)
      }
      if (
        /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|invalid\s*API\s*key|API\s*key\s*not\s*valid|API key expired|key expired/i.test(
          raw,
        )
      ) {
        Alerts.geminiKeyInvalid()
        return c.json(
          {
            message:
              'A chave GEMINI_API_KEY expirou ou é inválida. Gere uma nova em https://aistudio.google.com/app/apikey e atualize o .env do servidor (depois reinicie com pm2 restart severino).',
          },
          503,
        )
      }
      if (/quota|RESOURCE_EXHAUSTED|exceeded your current quota|429/i.test(raw)) {
        Alerts.geminiQuota()
        return c.json(
          {
            message:
              'Limite de uso da API Gemini atingido. Aguarde alguns minutos ou verifique o plano em Google AI Studio.',
          },
          503,
        )
      }
      if (
        /^Gemini API \d{3}:/i.test(raw) ||
        raw.includes('Resposta vazia da API do Gemini') ||
        /^Resposta vazia \(/i.test(raw)
      ) {
        Alerts.geminiGenericFail(raw)
        return c.json(
          {
            message:
              'O assistente não obteve resposta válida da API Gemini. Confirme GEMINI_API_KEY no servidor, quotas em Google AI Studio e, se precisar, defina GEMINI_MODEL=gemini-2.0-flash. Os detalhes técnicos foram registados no log do servidor.',
          },
          502,
        )
      }
      return c.json(
        { message: 'Não foi possível processar sua pergunta agora. Tente novamente.' },
        500,
      )
    }
  })

  app.post('/api/ai/suggest-category', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!await rateLimitTake(`ai-suggest-cat:${parsed.actorId}`, 60, 60_000)) {
        return c.json({ categoria_id: null, subcategoria_id: null })
      }

      const body = await c.req.json()
      const descricao = String(body?.descricao || '').trim()
      const tipo = String(body?.tipo || '').trim().toUpperCase()

      if (!descricao || descricao.length < 2) {
        return c.json({ categoria_id: null, subcategoria_id: null })
      }
      if (tipo !== 'DESPESA' && tipo !== 'RECEITA') {
        return c.json({ message: 'tipo inválido' }, 400)
      }

      const categorias = await getCategorias(parsed.dataUsuarioId)
      const result = await suggestCategoryForTransaction(descricao, tipo, categorias)
      return c.json(result)
    } catch (error) {
      log.warn('ai suggest-category failed', error?.message || error)
      return c.json({ categoria_id: null, subcategoria_id: null })
    }
  })

}
