import { log } from '../lib/logger.mjs'
import { Alerts } from '../lib/notify-telegram.mjs'
import {
  askHorizon,
  suggestCategoryForTransaction,
  parseWhatsAppMessageWithAI,
  analisarRelatorioFinanceiro,
} from '../lib/ai.mjs'
import { getCategorias } from '../lib/transacoes.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

/** Mapeia erros do Gemini para uma resposta HTTP amigável (compartilhado entre rotas de IA). */
function mapGeminiErrorToResponse(c, error) {
  const raw = String(error?.message || '')
  if (raw.includes('GEMINI_API_KEY') || /GEMINI_API_KEY não configurada/i.test(raw)) {
    return c.json({ message: 'Chave de API do Gemini não configurada no servidor.' }, 500)
  }
  if (raw.includes('filtro de segurança')) {
    return c.json({ message: raw }, 422)
  }
  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|invalid\s*API\s*key|API key expired|key expired/i.test(raw)) {
    Alerts.geminiKeyInvalid()
    return c.json({ message: 'A chave da IA expirou ou é inválida. Avise o suporte.' }, 503)
  }
  if (/quota|RESOURCE_EXHAUSTED|exceeded your current quota|429/i.test(raw)) {
    Alerts.geminiQuota()
    return c.json({ message: 'Limite de uso da IA atingido. Tente novamente em alguns minutos.' }, 503)
  }
  if (/^Gemini API \d{3}:/i.test(raw) || raw.includes('Resposta vazia da API do Gemini') || /^Resposta vazia \(/i.test(raw)) {
    Alerts.geminiGenericFail(raw)
    return c.json({ message: 'A IA não retornou uma resposta válida. Tente novamente.' }, 502)
  }
  return c.json({ message: 'Não foi possível processar a IA agora. Tente novamente.' }, 500)
}

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
      // actorId: correções são pessoais (a memória de comerciante é do usuário que lança).
      const result = await suggestCategoryForTransaction(descricao, tipo, categorias, parsed.actorId)
      return c.json(result)
    } catch (error) {
      log.warn('ai suggest-category failed', error?.message || error)
      return c.json({ categoria_id: null, subcategoria_id: null })
    }
  })

  // Linguagem natural → transação estruturada (ex.: "gastei 45 com gasolina").
  // Reusa o mesmo parser do WhatsApp. Devolve campos para autopreencher o modal.
  // tipo === 'CHAT' = não identificou uma transação (não autopreenche).
  app.post('/api/ai/parse-transaction', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!await rateLimitTake(`ai-parse-tx:${parsed.actorId}`, 40, 60_000)) {
        return c.json({ tipo: 'CHAT', message: 'Muitas tentativas seguidas. Aguarde um momento.' }, 429)
      }

      const body = await c.req.json().catch(() => ({}))
      const texto = String(body?.texto || '').trim()
      if (texto.length < 3) return c.json({ tipo: 'CHAT' })

      const categorias = await getCategorias(parsed.dataUsuarioId)
      const extracted = await parseWhatsAppMessageWithAI(texto, categorias, parsed.dataUsuarioId)

      const toTransacaoDto = (t) => ({
        tipo: t.tipo,
        valor: t.valor ?? null,
        categoria_id: t.categoria_id ?? null,
        subcategoria_id: t.subcategoria_id ?? null,
        descricao: t.descricao ?? '',
        data_transacao: t.data_transacao ?? null,
      })

      // Várias transações na mesma frase: o modal preenche a 1ª e avisa o usuário
      // (o form é de uma transação por vez; itens já vêm validados pelo sanitize).
      if (extracted?.tipo === 'MULTIPLO' && Array.isArray(extracted.transacoes) && extracted.transacoes.length > 0) {
        return c.json({
          tipo: 'MULTIPLO',
          transacoes: extracted.transacoes.map(toTransacaoDto),
        })
      }

      if (!extracted || (extracted.tipo !== 'DESPESA' && extracted.tipo !== 'RECEITA')) {
        return c.json({ tipo: 'CHAT' })
      }

      return c.json({
        ...toTransacaoDto(extracted),
        // "comprei TV em 10x" → o modal liga o toggle de parcelado (sanitize já clampa 2-120)
        parcelamento: extracted.parcelamento?.num_parcelas
          ? { num_parcelas: extracted.parcelamento.num_parcelas }
          : null,
      })
    } catch (error) {
      log.warn('ai parse-transaction failed', error?.message || error)
      return c.json({ tipo: 'CHAT' })
    }
  })

  // Análise narrativa de um período de relatório. Recebe os agregados já
  // computados no frontend (respeita o filtro de período/categoria da tela) e
  // devolve um diagnóstico curto em linguagem natural.
  app.post('/api/ai/analise-relatorio', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: false })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!await rateLimitTake(`ai-analise-rel:${parsed.actorId}:${clientKeyFromHono(c)}`, 12, 60_000)) {
        return c.json({ message: 'Muitas análises seguidas. Aguarde cerca de um minuto e tente de novo.' }, 429)
      }

      const body = await c.req.json().catch(() => ({}))
      const dados = body?.dados && typeof body.dados === 'object' ? body.dados : null
      if (!dados) return c.json({ message: 'Dados do período ausentes.' }, 400)

      const resposta = await analisarRelatorioFinanceiro(dados, null)
      return c.json({ resposta })
    } catch (error) {
      log.error('ai analise-relatorio failed', error)
      return mapGeminiErrorToResponse(c, error)
    }
  })

}
