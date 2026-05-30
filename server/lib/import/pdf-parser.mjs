import { log } from '../logger.mjs'
import {
  buildGeminiGenerationConfig,
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from '../ai/gemini-client.mjs'
import { tryParseJsonBlock } from '../ai/parsers.mjs'

const SIZE_LIMIT = 20 * 1024 * 1024

const PDF_PROMPT = `Você é um extrator de transações financeiras. Analise este extrato bancário e extraia TODAS as transações.

Retorne APENAS um array JSON válido (sem markdown, sem explicação) no formato:
[
  {"data":"2024-01-15","descricao":"MERCADO EXTRA","valor":87.50,"tipo":"DESPESA"},
  {"data":"2024-01-20","descricao":"SALARIO EMPRESA XYZ","valor":3500.00,"tipo":"RECEITA"}
]

Regras:
- Ignore totais, saldos, cabeçalhos, rodapés e linhas sem valor
- valor: sempre número positivo
- tipo: "DESPESA" para saídas/débitos/pagamentos, "RECEITA" para entradas/créditos/depósitos
- data: formato YYYY-MM-DD obrigatório
- descricao: texto limpo sem quebras de linha, máximo 255 caracteres
- Se não encontrar transações, retorne []`

function isValidRow(row) {
  if (!row || typeof row !== 'object') return false
  if (!row.data || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.data))) return false
  const valor = Number(row.valor)
  if (!valor || valor <= 0) return false
  if (!String(row.descricao || '').trim()) return false
  if (row.tipo !== 'DESPESA' && row.tipo !== 'RECEITA') return false
  return true
}

function normalizeRows(rawArray) {
  if (!Array.isArray(rawArray)) return []
  return rawArray
    .filter(isValidRow)
    .map((r) => ({
      data: String(r.data),
      descricao: String(r.descricao).trim().slice(0, 255),
      valor: Math.abs(Number(r.valor)),
      tipo: r.tipo,
    }))
}

export async function parsePdfTransactions(buffer) {
  if (!Buffer.isBuffer(buffer)) return { error: 'FORMATO_INVALIDO', message: 'Buffer inválido.' }
  if (buffer.length > SIZE_LIMIT) {
    return { error: 'ARQUIVO_MUITO_GRANDE', message: 'PDF muito grande (máx. 20MB).' }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'FALHA_IA', message: 'Chave Gemini não configurada.' }

  const base64 = buffer.toString('base64')
  const models = resolveGeminiModelCandidates()

  for (const mid of models) {
    try {
      log.info('[pdf-parser] tentando modelo', { model: mid, sizeKb: Math.round(buffer.length / 1024) })

      const response = await geminiPostGenerateContent(mid, apiKey, {
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: base64 } },
              { text: PDF_PROMPT },
            ],
          },
        ],
        generationConfig: buildGeminiGenerationConfig(mid, {
          maxOutputTokens: 8192,
          temperature: 0.1,
        }),
      })

      if (!response.ok) {
        log.warn('[pdf-parser] resposta não-ok', { model: mid, status: response.status })
        continue
      }

      const json = await response.json()
      const text = json?.candidates?.[0]?.content?.parts?.find((p) => !p.thought && p.text)?.text || ''
      if (!text) continue

      let parsed
      try {
        const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
        parsed = JSON.parse(cleaned)
      } catch {
        try {
          parsed = tryParseJsonBlock(text)
        } catch {
          log.warn('[pdf-parser] JSON inválido', { model: mid, preview: text.slice(0, 200) })
          continue
        }
      }

      const rows = normalizeRows(parsed)
      if (!rows.length) {
        return { error: 'NENHUMA_TRANSACAO', message: 'Não encontrei transações válidas no PDF. Verifique se é um extrato bancário padrão.' }
      }

      log.info('[pdf-parser] concluído', { model: mid, transacoes: rows.length })
      return rows
    } catch (e) {
      log.warn('[pdf-parser] erro no modelo', { model: mid, detail: String(e?.message || e).slice(0, 200) })
    }
  }

  return { error: 'FALHA_IA', message: 'Não consegui processar o PDF agora. Tente novamente em alguns minutos.' }
}
