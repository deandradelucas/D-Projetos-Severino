import { log } from '../lib/logger.mjs'
import { rateLimitTake, clientKeyFromHono } from '../lib/rate-limit.mjs'
import { parseUsuarioEscopoApi } from '../lib/http/api-usuario-escopo.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'
import { parseExcelTransactions } from '../lib/import/excel-parser.mjs'
import { parsePdfTransactions } from '../lib/import/pdf-parser.mjs'
import { parseOfxTransactions } from '../lib/import/ofx-parser.mjs'
import { importarTransacoes } from '../lib/import/import-service.mjs'

const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
])
const PDF_MIMES = new Set(['application/pdf'])
const OFX_MIMES = new Set(['application/x-ofx', 'application/ofx', 'application/x-qfx'])
const EXCEL_EXTS = new Set(['.xlsx', '.xls', '.csv'])
const PDF_EXTS = new Set(['.pdf'])
const OFX_EXTS = new Set(['.ofx', '.qfx'])

const EXCEL_SIZE_LIMIT = 10 * 1024 * 1024
const PDF_SIZE_LIMIT = 20 * 1024 * 1024

function resolveFormat(mimeType, fileName) {
  const mime = String(mimeType || '').toLowerCase().split(';')[0].trim()
  const ext = fileName ? `.${String(fileName).split('.').pop().toLowerCase()}` : ''
  if (EXCEL_MIMES.has(mime) || EXCEL_EXTS.has(ext)) return 'excel'
  if (PDF_MIMES.has(mime) || PDF_EXTS.has(ext)) return 'pdf'
  if (OFX_MIMES.has(mime) || OFX_EXTS.has(ext)) return 'ofx'
  return null
}

export function registerImportRoutes(app) {
  app.post('/api/import/planilha', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      const parsed = await parseUsuarioEscopoApi(usuarioId, { write: true })
      if (!parsed.ok) return c.json({ message: parsed.message }, parsed.status)

      if (!await rateLimitTake(`import-planilha:${parsed.actorId}`, 5, 3600_000)) {
        return c.json({ message: 'Limite de importações atingido (5 por hora). Tente novamente mais tarde.' }, 429)
      }

      let formData
      try {
        formData = await c.req.parseBody()
      } catch {
        return c.json({ message: 'Envie o arquivo como multipart/form-data com o campo "arquivo".' }, 400)
      }

      const file = formData['arquivo']
      if (!file || typeof file === 'string') {
        return c.json({ message: 'Campo "arquivo" obrigatório (multipart/form-data).' }, 400)
      }

      const mimeType = String(file.type || '').toLowerCase()
      const fileName = String(file.name || '')
      const format = resolveFormat(mimeType, fileName)

      if (!format) {
        return c.json({ message: 'Formato não suportado. Envie .xlsx, .xls, .csv, .pdf, .ofx ou .qfx.' }, 400)
      }

      const sizeLimit = format === 'pdf' ? PDF_SIZE_LIMIT : EXCEL_SIZE_LIMIT
      if (file.size > sizeLimit) {
        const maxMb = Math.round(sizeLimit / (1024 * 1024))
        return c.json({ message: `Arquivo muito grande (máx. ${maxMb}MB).` }, 413)
      }

      const buffer = Buffer.from(await file.arrayBuffer())

      let rows
      if (format === 'excel') {
        rows = await parseExcelTransactions(buffer, mimeType)
      } else if (format === 'pdf') {
        rows = await parsePdfTransactions(buffer)
      } else {
        rows = await parseOfxTransactions(buffer)
      }

      if (rows?.error) {
        const msgs = {
          FORMATO_INVALIDO: 'Arquivo corrompido ou formato inválido.',
          ARQUIVO_MUITO_GRANDE: 'Arquivo muito grande.',
          PLANILHA_VAZIA: 'A planilha está vazia.',
          NENHUMA_TRANSACAO: 'Nenhuma transação encontrada no arquivo.',
          COLUNAS_NAO_IDENTIFICADAS: 'Não foi possível identificar as colunas da planilha. Tente o formato OFX.',
          FALHA_IA: 'Serviço de IA indisponível. Tente novamente.',
        }
        return c.json({ message: msgs[rows.error] || 'Erro ao processar o arquivo.', code: rows.error }, 422)
      }

      if (!Array.isArray(rows) || !rows.length) {
        return c.json({ message: 'Nenhuma transação válida encontrada.', code: 'NENHUMA_TRANSACAO' }, 422)
      }

      const resumo = await importarTransacoes(parsed.dataUsuarioId, rows, { fontePlanilha: `web:${format}` })

      log.info('[import-route] concluído', { usuarioId: parsed.dataUsuarioId, format, ...resumo })
      return c.json({ ok: true, ...resumo })
    } catch (error) {
      log.error('[import-route] erro inesperado', error)
      return c.json({ message: 'Erro interno ao processar importação.' }, 500)
    }
  })
}
