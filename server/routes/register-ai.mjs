import { log } from '../lib/logger.mjs'
import { assertAcessoAppUsuario } from '../lib/assinatura.mjs'
import { getCategorias } from '../lib/transacoes.mjs'
import {
  askHorizon,
  parseAgendaFromTextWithAI,
  parseWhatsAppMessageWithAI,
} from '../lib/ai.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'

export function registerAiRoutes(app) {
  app.post('/api/ai/chat', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) {
        return c.json({ message: 'Não autorizado.' }, 401)
      }

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      const body = await c.req.json()
      const message = String(body?.message || '').trim()
      const historico = Array.isArray(body?.historico) ? body.historico : []

      if (!message) {
        return c.json({ message: 'Mensagem não pode estar vazia.' }, 400)
      }

      const resposta = await askHorizon(message, usuarioId, historico)

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
        /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|invalid\s*API\s*key|API\s*key\s*not\s*valid/i.test(
          raw,
        )
      ) {
        return c.json(
          {
            message:
              'A chave GEMINI_API_KEY é inválida ou foi revogada. Crie uma nova em https://aistudio.google.com/app/apikey e atualize o servidor (.env ou variáveis no Vercel).',
          },
          503,
        )
      }
      if (/quota|RESOURCE_EXHAUSTED|exceeded your current quota|429/i.test(raw)) {
        return c.json(
          {
            message:
              'Limite de uso da API Gemini atingido. Aguarde alguns minutos ou verifique o plano em Google AI Studio.',
          },
          503,
        )
      }
      if (/^Gemini API \d{3}:/i.test(raw) || raw.includes('Resposta vazia da API do Gemini')) {
        return c.json(
          {
            message:
              'O assistente não obteve resposta válida da API Gemini. Confirme GEMINI_API_KEY no servidor, quotas em Google AI Studio e, se precisar, defina GEMINI_MODEL=gemini-2.0-flash. Os detalhes técnicos foram registados no log do servidor.',
          },
          502,
        )
      }
      if (raw && raw.length < 280) {
        return c.json({ message: raw }, 500)
      }
      return c.json(
        { message: 'Não foi possível processar sua pergunta agora. Tente novamente.' },
        500,
      )
    }
  })

  app.post('/api/ai/agenda-parse', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      if (!rateLimitTake(`ai-parse:${usuarioId}:${clientKeyFromHono(c)}`, 24, 60_000)) {
        return c.json({ message: 'Muitas interpretações seguidas. Aguarde um minuto.' }, 429)
      }

      const body = await c.req.json()
      const texto = String(body?.texto ?? '').trim()
      if (!texto) return c.json({ message: 'Envie o texto a interpretar.' }, 400)

      const rascunho = await parseAgendaFromTextWithAI(texto, new Date())
      return c.json({ ok: true, rascunho })
    } catch (error) {
      log.error('ai agenda-parse failed', error)
      const raw = String(error?.message || '')
      if (raw.includes('GEMINI_API_KEY') || /GEMINI_API_KEY não configurada/i.test(raw)) {
        return c.json(
          {
            message:
              'IA não configurada no servidor (GEMINI_API_KEY). O app tentará regras locais quando possível.',
          },
          503,
        )
      }
      if (raw && raw.length < 320) return c.json({ message: raw }, 400)
      return c.json({ message: 'Não foi possível interpretar o texto. Reformule com data e horário.' }, 400)
    }
  })

  app.post('/api/ai/transacao-parse', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      if (!rateLimitTake(`ai-tx-parse:${usuarioId}:${clientKeyFromHono(c)}`, 24, 60_000)) {
        return c.json({ message: 'Muitas interpretações seguidas. Aguarde um minuto.' }, 429)
      }

      const body = await c.req.json()
      const texto = String(body?.texto ?? '').trim()
      if (!texto) return c.json({ message: 'Envie o texto a interpretar.' }, 400)

      const categorias = await getCategorias(usuarioId)
      const resultado = await parseWhatsAppMessageWithAI(texto, categorias)
      return c.json({ ok: true, resultado })
    } catch (error) {
      log.error('ai transacao-parse failed', error)
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
      if (/quota|RESOURCE_EXHAUSTED|429/i.test(raw)) {
        return c.json(
          {
            message:
              'Limite de uso da API Gemini atingido. Aguarde alguns minutos ou verifique o plano em Google AI Studio.',
          },
          503,
        )
      }
      if (raw && raw.length < 280) return c.json({ message: raw }, 500)
      return c.json({ message: 'Não foi possível interpretar agora. Tente de novo.' }, 500)
    }
  })
}
