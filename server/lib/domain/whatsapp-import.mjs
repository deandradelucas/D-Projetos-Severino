import { log } from '../logger.mjs'
import { buscarUsuarioPorTelefone } from '../usuarios.mjs'
import { computeAssinaturaFlags } from '../assinatura-flags.mjs'
import { parseExcelTransactions } from '../import/excel-parser.mjs'
import { parsePdfTransactions } from '../import/pdf-parser.mjs'
import { parseOfxTransactions } from '../import/ofx-parser.mjs'
import { importarTransacoes } from '../import/import-service.mjs'

const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'text/comma-separated-values',
])
const PDF_MIMES = new Set(['application/pdf'])
const OFX_MIMES = new Set(['application/x-ofx', 'application/ofx', 'application/x-qfx'])

const EXCEL_EXTS = new Set(['.xlsx', '.xls', '.csv', '.ods'])
const PDF_EXTS = new Set(['.pdf'])
const OFX_EXTS = new Set(['.ofx', '.qfx'])

const EXCEL_SIZE_LIMIT = 10 * 1024 * 1024
const PDF_SIZE_LIMIT = 20 * 1024 * 1024

function resolveFormatFromMimeAndName(mimeType, fileName) {
  const mime = String(mimeType || '').toLowerCase().split(';')[0].trim()
  const ext = fileName ? `.${String(fileName).split('.').pop().toLowerCase()}` : ''

  if (EXCEL_MIMES.has(mime) || EXCEL_EXTS.has(ext)) return 'excel'
  if (PDF_MIMES.has(mime) || PDF_EXTS.has(ext)) return 'pdf'
  if (OFX_MIMES.has(mime) || OFX_EXTS.has(ext)) return 'ofx'
  return null
}

function formatResumo(resumo) {
  const { importadas, ignoradas, erros, despesas, receitas, semCategoria } = resumo

  if (!importadas && !ignoradas) {
    return '📄 Não encontrei transações válidas no arquivo. Verifique se é um extrato bancário padrão.'
  }

  const linhas = [`✅ Importei *${importadas} transação${importadas !== 1 ? 'ões' : ''}* com sucesso!`, '']

  if (despesas || receitas) {
    const partes = []
    if (despesas) partes.push(`💸 ${despesas} despesa${despesas !== 1 ? 's' : ''}`)
    if (receitas) partes.push(`🟢 ${receitas} receita${receitas !== 1 ? 's' : ''}`)
    linhas.push(partes.join(' · '))
  }

  if (semCategoria > 0) {
    linhas.push(`⚠️ ${semCategoria} sem categoria — aparecem como "Outros"`)
  }

  if (ignoradas > 0) {
    linhas.push(`↩️ ${ignoradas} já existiam (ignoradas)`)
  }

  if (erros > 0) {
    linhas.push(`❌ ${erros} com erro ao salvar`)
  }

  linhas.push('')
  linhas.push('Abra o app para conferir e ajustar as categorias. 📱')

  return linhas.join('\n')
}

export async function processarImportacaoDocumento(phone, documentBuffer, mimeType, fileName) {
  const format = resolveFormatFromMimeAndName(mimeType, fileName)

  log.info('[whatsapp-import] documento recebido', {
    phone,
    mimeType,
    fileName: fileName || '',
    format: format || 'desconhecido',
    sizeKb: Math.round(documentBuffer.length / 1024),
  })

  if (!format) {
    return {
      ok: false,
      reply: '❌ Formato não reconhecido. Envie um arquivo *.xlsx*, *.xls*, *.csv*, *.pdf*, *.ofx* ou *.qfx*.',
    }
  }

  const sizeLimit = format === 'pdf' ? PDF_SIZE_LIMIT : EXCEL_SIZE_LIMIT
  if (documentBuffer.length > sizeLimit) {
    const maxMb = Math.round(sizeLimit / (1024 * 1024))
    return {
      ok: false,
      reply: `📄 Arquivo muito grande (máx. ${maxMb}MB). Tente um extrato menor.`,
    }
  }

  const usuario = await buscarUsuarioPorTelefone(phone, { usarGemini: false })
  if (!usuario?.id) {
    return {
      ok: false,
      reply: '📱 Número não cadastrado no Severino. Acesse o app para criar sua conta.',
    }
  }

  const flags = await computeAssinaturaFlags(usuario)
  if (flags.bloqueado) {
    return {
      ok: false,
      reply: '🔒 Sua assinatura está inativa. Acesse o app para renovar e continuar importando.',
    }
  }

  let rows
  try {
    if (format === 'excel') {
      rows = await parseExcelTransactions(documentBuffer, mimeType)
    } else if (format === 'pdf') {
      rows = await parsePdfTransactions(documentBuffer)
    } else {
      rows = await parseOfxTransactions(documentBuffer)
    }
  } catch (e) {
    log.warn('[whatsapp-import] erro inesperado no parser', { format, detail: String(e?.message || e).slice(0, 200) })
    return { ok: false, reply: '❌ Erro ao processar o arquivo. Tente novamente.' }
  }

  if (rows?.error) {
    const msgs = {
      FORMATO_INVALIDO: '❌ Arquivo corrompido ou formato inválido. Tente exportar novamente pelo seu banco.',
      ARQUIVO_MUITO_GRANDE: '📄 Arquivo muito grande. Tente um extrato com menos meses.',
      PLANILHA_VAZIA: '📊 A planilha está vazia. Verifique o arquivo e tente novamente.',
      NENHUMA_TRANSACAO: '🔍 Não encontrei transações no arquivo. Verifique se é um extrato bancário padrão.',
      COLUNAS_NAO_IDENTIFICADAS: '📊 Não consegui identificar as colunas da planilha. Tente exportar no formato OFX pelo seu banco.',
      FALHA_IA: '⏳ Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.',
    }
    return { ok: false, reply: msgs[rows.error] || '❌ Não consegui processar o arquivo.' }
  }

  if (!Array.isArray(rows) || !rows.length) {
    return { ok: false, reply: '🔍 Não encontrei transações válidas no arquivo.' }
  }

  let resumo
  try {
    resumo = await importarTransacoes(usuario.id, rows, { fontePlanilha: `whatsapp:${format}` })
  } catch (e) {
    log.warn('[whatsapp-import] erro no import service', { detail: String(e?.message || e).slice(0, 200) })
    return { ok: false, reply: '❌ Erro ao salvar as transações. Tente novamente.' }
  }

  log.info('[whatsapp-import] concluído', { phone, format, ...resumo })
  return { ok: true, reply: formatResumo(resumo) }
}
