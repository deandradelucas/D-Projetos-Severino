/** Validação de entrada para POST/PUT /api/transacoes (evita payloads absurdos e erros genéricos 500). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIPOS = new Set(['RECEITA', 'DESPESA'])
const STATUS_OK = new Set(['PENDENTE', 'EFETIVADA', 'CANCELADA'])
const FREQ_OK = new Set(['MENSAL', 'SEMANAL', 'ANUAL'])

const MAX_DESCRICAO = 4000
const MAX_VALOR = 1e15

export function isUuidString(s) {
  return typeof s === 'string' && UUID_RE.test(s.trim())
}

function parseValor(v) {
  if (v === null || v === undefined) return NaN
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/**
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateNovaTransacaoBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Corpo da requisição deve ser um objeto JSON.' }
  }

  const tipo = String(body.tipo || '').trim().toUpperCase()
  if (!TIPOS.has(tipo)) {
    return { ok: false, message: 'Tipo deve ser RECEITA ou DESPESA.' }
  }

  const valNum = parseValor(body.valor)
  if (valNum <= 0 || valNum > MAX_VALOR) {
    return { ok: false, message: 'Valor inválido.' }
  }

  const dt = body.data_transacao
  if (dt === null || dt === undefined || String(dt).trim() === '') {
    return { ok: false, message: 'Informe a data da transação.' }
  }
  const t = Date.parse(String(dt))
  if (Number.isNaN(t)) {
    return { ok: false, message: 'Data da transação inválida.' }
  }

  if (body.categoria_id != null && body.categoria_id !== '' && !isUuidString(String(body.categoria_id))) {
    return { ok: false, message: 'categoria_id inválido.' }
  }
  if (body.subcategoria_id != null && body.subcategoria_id !== '' && !isUuidString(String(body.subcategoria_id))) {
    return { ok: false, message: 'subcategoria_id inválido.' }
  }

  if (body.conta_id != null && body.conta_id !== '' && !isUuidString(String(body.conta_id))) {
    return { ok: false, message: 'conta_id inválido.' }
  }

  if (body.status != null && body.status !== '') {
    const st = String(body.status).trim().toUpperCase()
    if (!STATUS_OK.has(st)) {
      return { ok: false, message: 'Status inválido.' }
    }
  }

  const desc = body.descricao != null ? String(body.descricao) : ''
  if (desc.length > MAX_DESCRICAO) {
    return { ok: false, message: 'Descrição muito longa.' }
  }

  if (body.recorrencia != null && typeof body.recorrencia === 'object' && !Array.isArray(body.recorrencia)) {
    const q = Number(body.recorrencia.quantidade)
    const freq = String(body.recorrencia.frequencia || '').trim().toUpperCase()
    if (!Number.isFinite(q) || q < 2 || q > 120) {
      return { ok: false, message: 'Recorrência: quantidade deve ser entre 2 e 120.' }
    }
    if (!FREQ_OK.has(freq)) {
      return { ok: false, message: 'Recorrência: frequência inválida.' }
    }
  } else if (body.recorrencia != null) {
    return { ok: false, message: 'Campo recorrencia inválido.' }
  }

  return { ok: true }
}

/**
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateAtualizacaoTransacaoBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Corpo da requisição deve ser um objeto JSON.' }
  }

  const tipo = String(body.tipo || '').trim().toUpperCase()
  if (!TIPOS.has(tipo)) {
    return { ok: false, message: 'Tipo deve ser RECEITA ou DESPESA.' }
  }

  const valNum = parseValor(body.valor)
  if (valNum <= 0 || valNum > MAX_VALOR) {
    return { ok: false, message: 'Valor inválido.' }
  }

  const dt = body.data_transacao
  if (dt === null || dt === undefined || String(dt).trim() === '') {
    return { ok: false, message: 'Informe a data da transação.' }
  }
  if (Number.isNaN(Date.parse(String(dt)))) {
    return { ok: false, message: 'Data da transação inválida.' }
  }

  if (body.categoria_id != null && body.categoria_id !== '' && !isUuidString(String(body.categoria_id))) {
    return { ok: false, message: 'categoria_id inválido.' }
  }
  if (body.subcategoria_id != null && body.subcategoria_id !== '' && !isUuidString(String(body.subcategoria_id))) {
    return { ok: false, message: 'subcategoria_id inválido.' }
  }

  if (body.status != null && body.status !== '') {
    const st = String(body.status).trim().toUpperCase()
    if (!STATUS_OK.has(st)) {
      return { ok: false, message: 'Status inválido.' }
    }
  }

  const desc = body.descricao != null ? String(body.descricao) : ''
  if (desc.length > MAX_DESCRICAO) {
    return { ok: false, message: 'Descrição muito longa.' }
  }

  return { ok: true }
}

/**
 * Valida query string de GET /api/transacoes (limit/offset).
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateTransacoesListQuery(query) {
  const limRaw = query.limit
  if (limRaw !== undefined && limRaw !== null && String(limRaw).trim() !== '') {
    const n = parseInt(String(limRaw), 10)
    if (!Number.isFinite(n) || n < 1 || n > 2000) {
      return { ok: false, message: 'Parâmetro limit inválido (1–2000).' }
    }
  }
  const offRaw = query.offset
  if (offRaw !== undefined && offRaw !== null && String(offRaw).trim() !== '') {
    const n = parseInt(String(offRaw), 10)
    if (!Number.isFinite(n) || n < 0 || n > 50_000) {
      return { ok: false, message: 'Parâmetro offset inválido.' }
    }
  }
  return { ok: true }
}
