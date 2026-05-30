import { log } from '../logger.mjs'
import { detectBankFromOfxText } from './bank-detector.mjs'

const SIZE_LIMIT = 10 * 1024 * 1024

const OFX_TRNTYPE_MAP = {
  DEBIT: 'DESPESA',
  CHECK: 'DESPESA',
  PAYMENT: 'DESPESA',
  DIRECTDEBIT: 'DESPESA',
  ATM: 'DESPESA',
  FEE: 'DESPESA',
  CREDIT: 'RECEITA',
  DEP: 'RECEITA',
  DIRECTDEP: 'RECEITA',
  INTEREST: 'RECEITA',
  DIVIDEND: 'RECEITA',
  XFER: null,
  OTHER: null,
  POS: 'DESPESA',
  REPEATPMT: 'DESPESA',
  SRVCHG: 'DESPESA',
}

function parseSgmlTag(block, tag) {
  const re = new RegExp(`<${tag}>([^\\n\\r<]+)`, 'i')
  const m = re.exec(block)
  return m ? m[1].trim() : ''
}

function parseOfxDate(raw) {
  const s = String(raw || '').replace(/[^0-9]/g, '').slice(0, 8)
  if (s.length < 8) return null
  const y = s.slice(0, 4)
  const mo = s.slice(4, 6)
  const d = s.slice(6, 8)
  const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`)
  if (isNaN(dt.getTime())) return null
  return `${y}-${mo}-${d}`
}

function parseOfxAmount(raw) {
  const s = String(raw || '').replace(',', '.').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function resolveType(trntype, amount) {
  const mapped = OFX_TRNTYPE_MAP[String(trntype || '').toUpperCase()]
  if (mapped) return mapped
  if (amount === null) return null
  return amount < 0 ? 'DESPESA' : 'RECEITA'
}

function extractBlocks(text) {
  const blocks = []
  const re = /<STMTTRN>([\s\S]*?)(?=<\/?STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRNRS>|<\/INVTRANLIST>|$)/gi
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[1]?.trim()) blocks.push(m[1])
  }
  return blocks
}

function parseBlocks(blocks) {
  const rows = []
  for (const block of blocks) {
    const trntype = parseSgmlTag(block, 'TRNTYPE')
    const dtposted = parseSgmlTag(block, 'DTPOSTED')
    const trnamt = parseSgmlTag(block, 'TRNAMT')
    const memo = parseSgmlTag(block, 'MEMO')
    const name = parseSgmlTag(block, 'NAME')
    const fitid = parseSgmlTag(block, 'FITID')

    const data = parseOfxDate(dtposted)
    if (!data) continue

    const amount = parseOfxAmount(trnamt)
    if (amount === null || amount === 0) continue

    const descricao = (memo || name || '').trim().slice(0, 255)
    if (!descricao) continue

    const tipo = resolveType(trntype, amount)
    if (!tipo) continue

    rows.push({
      data,
      descricao,
      valor: Math.abs(amount),
      tipo,
      fitid: fitid || null,
    })
  }
  return rows
}

function detectVersion(text) {
  const head = text.slice(0, 500)
  if (/OFXHEADER\s*:\s*100/i.test(head)) return 'sgml'
  if (/<\?OFX/i.test(head) || /<\?xml/i.test(head)) return 'xml'
  return 'sgml'
}

function decodeBuffer(buffer) {
  const utf8 = buffer.toString('utf-8')
  if (/CHARSET\s*:\s*1252/i.test(utf8.slice(0, 500)) || /[À-ÿ]/.test(utf8) === false) {
    try {
      const latin1 = buffer.toString('latin1')
      if (/[À-ÿ]/.test(latin1)) return latin1
    } catch { /* empty */ }
  }
  return utf8
}

export async function parseOfxTransactions(buffer) {
  if (!Buffer.isBuffer(buffer)) return { error: 'FORMATO_INVALIDO', message: 'Buffer inválido.' }
  if (buffer.length > SIZE_LIMIT) {
    return { error: 'ARQUIVO_MUITO_GRANDE', message: 'Arquivo OFX muito grande (máx. 10MB).' }
  }

  let text
  try {
    text = decodeBuffer(buffer)
  } catch {
    return { error: 'FORMATO_INVALIDO', message: 'Não foi possível ler o arquivo.' }
  }

  const version = detectVersion(text)
  log.info('[ofx-parser] detectado', { version, size: buffer.length })

  let blocks
  try {
    blocks = extractBlocks(text)
  } catch (e) {
    return { error: 'FORMATO_INVALIDO', message: `Erro ao parsear OFX: ${String(e?.message || e).slice(0, 120)}` }
  }

  if (!blocks.length) {
    return { error: 'NENHUMA_TRANSACAO', message: 'Nenhuma transação encontrada no arquivo OFX.' }
  }

  const rows = parseBlocks(blocks)
  if (!rows.length) {
    return { error: 'NENHUMA_TRANSACAO', message: 'Transações encontradas mas nenhuma com dados válidos (data, valor e descrição).' }
  }

  const banco = detectBankFromOfxText(text)
  log.info('[ofx-parser] concluído', { version, blocos: blocks.length, validas: rows.length, banco: banco?.nome || null })
  return { rows, banco }
}
