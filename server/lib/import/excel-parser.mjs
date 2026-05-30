import * as XLSX from 'xlsx'
import { log } from '../logger.mjs'
import {
  buildGeminiGenerationConfig,
  geminiPostGenerateContent,
  resolveGeminiModelCandidates,
} from '../ai/gemini-client.mjs'
import { tryParseJsonBlock } from '../ai/parsers.mjs'

const SIZE_LIMIT = 10 * 1024 * 1024
const ROW_LIMIT = 2000

const HEADER_HINTS = {
  col_data: /^(data|date|dt\.?|dia|vencimento|competencia|lançamento|lancamento)$/i,
  col_descricao: /^(descrição|descricao|histórico|historico|memo|lançamento|lancamento|description|detail|detalhes|estabelecimento|complemento)$/i,
  col_valor: /^(valor|value|amount|montante|quantia|débito.*crédito|crédito.*débito|mov|movimentação|movimentacao)$/i,
  col_debito: /^(débito|debito|saída|saida|debit|out|d[eé]bit)$/i,
  col_credito: /^(crédito|credito|entrada|credit|in|cred)$/i,
  col_tipo: /^(tipo|type|operação|operacao|natureza|dc|d\/c|c\/d)$/i,
}

function excelSerialToIso(serial) {
  const epoch = new Date(Date.UTC(1899, 11, 30))
  const ms = serial * 86400000
  const d = new Date(epoch.getTime() + ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parseDateCell(raw) {
  if (raw === null || raw === undefined || raw === '') return null

  if (typeof raw === 'number') return excelSerialToIso(raw)

  const s = String(raw).trim()

  const isoM = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (isoM) {
    const y = isoM[1], mo = isoM[2].padStart(2, '0'), d = isoM[3].padStart(2, '0')
    return `${y}-${mo}-${d}`
  }

  const brM = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/.exec(s)
  if (brM) {
    const d = brM[1].padStart(2, '0'), mo = brM[2].padStart(2, '0')
    const y = brM[3].length === 2 ? `20${brM[3]}` : brM[3]
    return `${y}-${mo}-${d}`
  }

  return null
}

function parseAmountCell(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(/\s/g, '')
  if (!s) return null
  const hasCommaDecimal = /,\d{1,2}$/.test(s)
  const normalized = hasCommaDecimal
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '')
  const n = parseFloat(normalized.replace(/[^\d.\-]/g, ''))
  return isNaN(n) ? null : n
}

function heuristicColumnMap(headers) {
  const map = { col_data: null, col_descricao: null, col_valor: null, col_debito: null, col_credito: null, col_tipo: null }
  headers.forEach((h, i) => {
    const s = String(h || '').trim()
    for (const [key, re] of Object.entries(HEADER_HINTS)) {
      if (map[key] === null && re.test(s)) map[key] = i
    }
  })
  return map
}

async function geminiDetectColumns(sampleRows) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const sample = JSON.stringify(sampleRows.slice(0, 6))
  const prompt =
    `Analise estas primeiras linhas de uma planilha de extrato bancário brasileiro e identifique os índices das colunas (0-based).\n\n` +
    `Linhas: ${sample}\n\n` +
    `Retorne APENAS JSON válido (sem markdown):\n` +
    `{"col_data":0,"col_descricao":1,"col_valor":2,"col_tipo":null,"col_debito":null,"col_credito":null,"tipo_credito_label":"","tipo_debito_label":""}\n\n` +
    `Regras:\n` +
    `- col_data: índice da coluna de data\n` +
    `- col_descricao: índice da coluna de descrição/histórico\n` +
    `- col_valor: índice da coluna de valor monetário (pode ser negativo para débito)\n` +
    `- col_tipo: índice da coluna que indica débito/crédito como texto (ou null se não existir)\n` +
    `- col_debito: índice de coluna exclusiva de débitos (ou null se não existir)\n` +
    `- col_credito: índice de coluna exclusiva de créditos (ou null se não existir)\n` +
    `- tipo_credito_label / tipo_debito_label: texto que aparece na coluna tipo para crédito/débito (ou "" se col_tipo for null)`

  const models = resolveGeminiModelCandidates()
  for (const mid of models) {
    try {
      const response = await geminiPostGenerateContent(mid, apiKey, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: buildGeminiGenerationConfig(mid, { maxOutputTokens: 200, temperature: 0.1 }),
      })
      if (!response.ok) continue
      const json = await response.json()
      const text = json?.candidates?.[0]?.content?.parts?.find((p) => !p.thought && p.text)?.text || ''
      if (!text) continue
      const parsed = tryParseJsonBlock(text)
      if (parsed && typeof parsed === 'object') return parsed
    } catch { /* continua para próximo modelo */ }
  }
  return null
}

function resolveColumnMap(headers, geminiMap) {
  const heuristic = heuristicColumnMap(headers)
  if (!geminiMap) return heuristic

  const merged = { ...heuristic }
  for (const key of Object.keys(heuristic)) {
    if (geminiMap[key] !== null && geminiMap[key] !== undefined && typeof geminiMap[key] === 'number') {
      merged[key] = geminiMap[key]
    }
  }
  merged.tipo_credito_label = String(geminiMap.tipo_credito_label || '').trim().toLowerCase()
  merged.tipo_debito_label = String(geminiMap.tipo_debito_label || '').trim().toLowerCase()
  return merged
}

function resolveRowType(colMap, row) {
  if (colMap.col_tipo !== null) {
    const tipoCel = String(row[colMap.col_tipo] || '').trim().toLowerCase()
    if (colMap.tipo_credito_label && tipoCel.includes(colMap.tipo_credito_label)) return 'RECEITA'
    if (colMap.tipo_debito_label && tipoCel.includes(colMap.tipo_debito_label)) return 'DESPESA'
    if (/crédito|credito|entrada|credit|rec/.test(tipoCel)) return 'RECEITA'
    if (/débito|debito|saída|saida|debit|pag/.test(tipoCel)) return 'DESPESA'
  }

  if (colMap.col_debito !== null && colMap.col_credito !== null) {
    const deb = parseAmountCell(row[colMap.col_debito])
    const cred = parseAmountCell(row[colMap.col_credito])
    if (cred && Math.abs(cred) > 0) return 'RECEITA'
    if (deb && Math.abs(deb) > 0) return 'DESPESA'
    return null
  }

  return null
}

function normalizeRows(dataRows, colMap) {
  const rows = []
  for (const row of dataRows) {
    const data = parseDateCell(row[colMap.col_data])
    if (!data) continue

    const descricao = String(row[colMap.col_descricao] ?? '').trim().slice(0, 255)
    if (!descricao) continue

    let valor = null
    let tipo = null

    if (colMap.col_debito !== null && colMap.col_credito !== null) {
      const deb = parseAmountCell(row[colMap.col_debito])
      const cred = parseAmountCell(row[colMap.col_credito])
      if (cred && Math.abs(cred) > 0) { valor = Math.abs(cred); tipo = 'RECEITA' }
      else if (deb && Math.abs(deb) > 0) { valor = Math.abs(deb); tipo = 'DESPESA' }
    } else if (colMap.col_valor !== null) {
      const raw = parseAmountCell(row[colMap.col_valor])
      if (raw === null || raw === 0) continue
      valor = Math.abs(raw)
      tipo = resolveRowType(colMap, row) || (raw < 0 ? 'DESPESA' : 'RECEITA')
    }

    if (!valor || !tipo) continue
    rows.push({ data, descricao, valor, tipo })
  }
  return rows
}

export async function parseExcelTransactions(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return { error: 'FORMATO_INVALIDO', message: 'Buffer inválido.' }
  if (buffer.length > SIZE_LIMIT) {
    return { error: 'ARQUIVO_MUITO_GRANDE', message: 'Planilha muito grande (máx. 10MB).' }
  }

  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true })
  } catch (e) {
    return { error: 'FORMATO_INVALIDO', message: `Arquivo não reconhecido como planilha: ${String(e?.message || '').slice(0, 100)}` }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { error: 'PLANILHA_VAZIA', message: 'Nenhuma aba encontrada na planilha.' }

  const sheet = workbook.Sheets[sheetName]
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false })

  if (!allRows.length) return { error: 'PLANILHA_VAZIA', message: 'Planilha sem dados.' }

  if (allRows.length > ROW_LIMIT + 1) {
    return { error: 'PLANILHA_MUITO_GRANDE', message: `Máximo de ${ROW_LIMIT} linhas por importação.` }
  }

  const headers = (allRows[0] || []).map((h) => String(h ?? ''))
  const dataRows = allRows.slice(1)

  log.info('[excel-parser] lendo planilha', { sheet: sheetName, cols: headers.length, rows: dataRows.length })

  let geminiMap = null
  try {
    geminiMap = await geminiDetectColumns(allRows)
  } catch {
    log.warn('[excel-parser] Gemini falhou na detecção de colunas — usando heurísticas')
  }

  const colMap = resolveColumnMap(headers, geminiMap)
  log.info('[excel-parser] mapeamento de colunas', { colMap })

  if (colMap.col_data === null || colMap.col_descricao === null) {
    return { error: 'COLUNAS_NAO_IDENTIFICADAS', message: 'Não consegui identificar as colunas de data e descrição. Verifique se a planilha é um extrato bancário padrão.' }
  }

  if (colMap.col_valor === null && (colMap.col_debito === null || colMap.col_credito === null)) {
    return { error: 'COLUNAS_NAO_IDENTIFICADAS', message: 'Não consegui identificar a coluna de valor. Verifique se a planilha é um extrato bancário padrão.' }
  }

  const rows = normalizeRows(dataRows, colMap)
  if (!rows.length) {
    return { error: 'NENHUMA_TRANSACAO', message: 'Nenhuma transação válida encontrada. Verifique se as datas e valores estão no formato correto.' }
  }

  log.info('[excel-parser] concluído', { validas: rows.length, total: dataRows.length })
  return rows
}
