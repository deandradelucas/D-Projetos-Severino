import './load-env.mjs'
import { log } from './logger.mjs'
import {
  buildGeminiGenerationConfig,
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from './ai/gemini-client.mjs'
import { extractTextFromGeminiResponse, contentsWithSystemPrepended } from './ai/parsers.mjs'
import { groqChatCompletion } from './ai/groq-client.mjs'
import { recordAiCall } from './ai/ai-telemetry.mjs'

const fmtBrl = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Gera uma análise narrativa CURTA do relatório de um período.
 *
 * Recebe os agregados já computados no frontend (`dados`) — isso garante que a
 * análise respeita exatamente o filtro de período/categoria que o usuário vê na
 * tela, sem reconsultar o banco. Faz uma única chamada ao Gemini.
 *
 * @param {Object} dados — agregados do período (receitas, despesas, top categorias, variações…)
 * @param {string|null} [nomeUsuario]
 * @returns {Promise<string>} texto da análise (com **negrito** estilo markdown leve)
 */
export async function analisarRelatorioFinanceiro(dados = {}, nomeUsuario = null) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  const {
    periodoLabel = 'o período',
    receitas = 0,
    despesas = 0,
    saldo = 0,
    taxaPoupanca = null,
    fixo = 0,
    variavel = 0,
    comprometimento = null,
    topDespesas = [],
    topReceitas = [],
    variacoes = [],
    deltaReceitas = null,
    deltaDespesas = null,
  } = dados || {}

  const linhasTop = (arr) =>
    (Array.isArray(arr) ? arr.slice(0, 5) : [])
      .filter((c) => c && c.nome)
      .map((c) => `  - ${c.nome}: ${fmtBrl(c.valor)}`)
      .join('\n') || '  (nenhum)'

  const linhasVar =
    (Array.isArray(variacoes) ? variacoes.slice(0, 6) : [])
      .filter((v) => v && v.nome)
      .map((v) => {
        const diff = num(v.diff)
        const sinal = diff >= 0 ? '+' : '−'
        const pct =
          v.pct != null && Number.isFinite(Number(v.pct))
            ? ` (${diff >= 0 ? '+' : ''}${Math.round(Number(v.pct))}%)`
            : ' (categoria nova)'
        return `  - ${v.nome}: ${sinal}${fmtBrl(Math.abs(diff))}${pct}`
      })
      .join('\n') || '  (sem comparativo com período anterior)'

  const dadosBloco = `
Período analisado: ${periodoLabel}
Receitas: ${fmtBrl(receitas)}${deltaReceitas != null ? ` (${num(deltaReceitas) >= 0 ? '+' : ''}${Math.round(num(deltaReceitas))}% vs período anterior)` : ''}
Despesas: ${fmtBrl(despesas)}${deltaDespesas != null ? ` (${num(deltaDespesas) >= 0 ? '+' : ''}${Math.round(num(deltaDespesas))}% vs período anterior)` : ''}
Saldo: ${fmtBrl(saldo)}${taxaPoupanca != null ? `\nTaxa de poupança: ${num(taxaPoupanca).toFixed(1)}%` : ''}
Despesas fixas/recorrentes: ${fmtBrl(fixo)}
Despesas variáveis: ${fmtBrl(variavel)}${comprometimento != null ? `\nComprometimento da renda com despesas fixas: ${Math.round(num(comprometimento))}%` : ''}

Maiores despesas por categoria:
${linhasTop(topDespesas)}

Maiores receitas por categoria:
${linhasTop(topReceitas)}

Maiores variações de gasto vs período anterior:
${linhasVar}
`.trim()

  const systemPrompt = `Você é o Severino — assistente financeiro pessoal. Analise o relatório de um período e produza um diagnóstico CURTO, em português do Brasil.

VOZ:
- Caloroso E direto: pessoal sem ser piegas, objetivo sem ser frio.${nomeUsuario ? ` Trate o usuário por "${nomeUsuario}" com naturalidade.` : ''}
- 3 a 5 frases no total. Texto corrido em 1 ou 2 parágrafos curtos. Nada de paredão de texto.
- Destaque os VALORES (R$) e os nomes de categoria em **negrito**.
- No máximo 1 emoji, e só quando couber.

CONTEÚDO:
- Baseie-se SÓ nos números abaixo. NUNCA invente categorias, valores ou transações.
- Comece pela leitura geral: o período foi positivo ou apertado, e por quê (use saldo e taxa de poupança).
- Aponte 1 destaque acionável com o NÚMERO (categoria que mais subiu, comprometimento da renda alto, poupança boa/ruim).
- Feche com UM próximo passo concreto.
- NÃO use títulos, listas com marcadores nem markdown além de **negrito**.
- Se não houver receitas no período, deixe claro que só houve saídas e foque nelas.

--- DADOS DO PERÍODO ---
${dadosBloco}
--- FIM DOS DADOS ---`

  const contents = [{ role: 'user', parts: [{ text: 'Analise meu período com base nos dados acima.' }] }]
  const modelIds = resolveGeminiModelCandidates()
  let lastError = null

  for (const modelId of modelIds) {
    const generationConfig = buildGeminiGenerationConfig(modelId, {
      maxOutputTokens: 1024,
      temperature: 0.6,
    })
    const payloads = [
      { systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig },
      { contents: contentsWithSystemPrepended(systemPrompt, contents), generationConfig },
    ]

    for (const payload of payloads) {
      try {
        const response = await geminiPostGenerateContent(modelId, apiKey, payload)
        const rawBody = await response.text()
        let json = {}
        if (rawBody) {
          try {
            json = JSON.parse(rawBody)
          } catch {
            lastError = new Error(`Gemini API ${response.status}: resposta JSON inválida`)
            if (payload.systemInstruction) continue
            break
          }
        }

        if (!response.ok) {
          const apiMsg = json?.error?.message || rawBody?.slice(0, 400) || 'sem detalhe'
          lastError = new Error(`Gemini API ${response.status}: ${apiMsg}`)
          log.warn('[analisarRelatorio] modelo falhou', { modelId, status: response.status })
          recordAiCall('gemini', 'relatorio', 'fail')
          if (payload.systemInstruction) continue
          break
        }

        const extracted = extractTextFromGeminiResponse(json)
        if (extracted.ok) {
          recordAiCall('gemini', 'relatorio', 'ok')
          return extracted.text
        }
        if (extracted.kind === 'prompt_blocked' || extracted.kind === 'response_blocked') {
          throw new Error('Não foi possível gerar a análise deste período (filtro de segurança).')
        }
        lastError = new Error(`Resposta vazia da API do Gemini (${extracted.kind})`)
        recordAiCall('gemini', 'relatorio', 'fail')
      } catch (e) {
        lastError = e
        if (/filtro de segurança/i.test(e?.message || '')) throw e
        recordAiCall('gemini', 'relatorio', 'fail')
        continue
      }
    }
  }

  // Fallback Groq quando todos os modelos Gemini falharam
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    try {
      const text = await groqChatCompletion({
        apiKey: groqKey,
        systemPrompt,
        userMessage: 'Analise meu período com base nos dados acima.',
        maxTokens: 1024,
        temperature: 0.6,
      })
      if (text && text.trim()) {
        recordAiCall('groq', 'relatorio', 'ok')
        return text.trim()
      }
      recordAiCall('groq', 'relatorio', 'fail')
    } catch (e) {
      recordAiCall('groq', 'relatorio', 'fail')
      log.warn('[analisarRelatorio] groq fallback error', e?.message)
    }
  }

  throw lastError || new Error('Não foi possível obter resposta do Gemini.')
}
