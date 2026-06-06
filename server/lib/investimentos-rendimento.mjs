/**
 * Cálculos de rendimento e IR para investimentos — lógica portada do frontend.
 * Convenção: pro rata via juros compostos em 252 dias úteis (padrão BCB/ANBIMA).
 */

const DIAS_UTEIS_ANO = 252

const BCB_CDI_URL =
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json'

let _cdiCache = null

export async function buscarTaxaCdiAa() {
  const now = Date.now()
  if (_cdiCache && now - _cdiCache.ts < 60 * 60 * 1000) return _cdiCache.valor
  try {
    const res = await fetch(BCB_CDI_URL, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`BCB ${res.status}`)
    const json = await res.json()
    if (!Array.isArray(json) || !json[0]?.valor) throw new Error('Formato inesperado')
    const valor = parseFloat(String(json[0].valor).replace(',', '.'))
    if (!Number.isFinite(valor)) throw new Error('CDI inválido')
    _cdiCache = { ts: now, valor }
    return valor
  } catch {
    return _cdiCache?.valor ?? null
  }
}

// ── Calendário ────────────────────────────────────────────────────────────────

function pascoa(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(y, month - 1, day)
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function feriadosBr(year) {
  const s = new Set()
  const add = (mo, day) => s.add(ymd(new Date(year, mo, day)))
  add(0, 1); add(3, 21); add(4, 1); add(8, 7); add(9, 12)
  add(10, 2); add(10, 15); add(11, 25)
  // Consciência Negra é feriado federal só a partir de 2023 (Lei 14.759/2023).
  // Antes disso havia pregão CDI normal — manter alinhado com o front (investimentosRendimentoIr.js).
  if (year >= 2023) add(10, 20)
  const p = pascoa(year)
  const shift = (base, d) => { const x = new Date(base); x.setDate(x.getDate() + d); return x }
  s.add(ymd(shift(p, -48))); s.add(ymd(shift(p, -47)))
  s.add(ymd(shift(p, -2))); s.add(ymd(shift(p, 60)))
  return s
}

const _ferCache = new Map()
function feriados(y) {
  if (!_ferCache.has(y)) _ferCache.set(y, feriadosBr(y))
  return _ferCache.get(y)
}

function parseDateLocal(iso) {
  if (!iso) return null
  const s = String(iso).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function ehDiaUtil(d) {
  const dow = d.getDay()
  return dow >= 1 && dow <= 5 && !feriados(d.getFullYear()).has(ymd(d))
}

export function contarDiasUteis(isoInicio, dataFim = new Date()) {
  const aquis = parseDateLocal(isoInicio)
  if (!aquis) return 0
  // CDI rende a partir do 1º pregão DEPOIS da aquisição (D+1 útil), não no dia da
  // aplicação. Alinha com o front (dataLocalInicioRendimentoCdiApartirDeIso).
  const start = new Date(aquis.getFullYear(), aquis.getMonth(), aquis.getDate())
  start.setDate(start.getDate() + 1)
  while (!ehDiaUtil(start)) start.setDate(start.getDate() + 1)
  const end = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate())
  if (end < start) return 0
  let n = 0
  const walk = new Date(start)
  while (walk <= end) {
    if (ehDiaUtil(walk)) n++
    walk.setDate(walk.getDate() + 1)
  }
  return n
}

export function diasCorridos(isoInicio) {
  const start = parseDateLocal(isoInicio)
  if (!start) return 0
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.floor((end - start) / 86400000))
}

export function ehDiaUtilHoje() {
  const d = new Date()
  const hoje = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = hoje.getDay()
  if (dow === 0 || dow === 6) return false
  return !feriados(hoje.getFullYear()).has(ymd(hoje))
}

// ── IR regressivo ─────────────────────────────────────────────────────────────

export function aliquotaIr(diasCorridos) {
  const d = Math.max(0, Math.floor(diasCorridos) || 0)
  if (d <= 180) return 0.225
  if (d <= 360) return 0.2
  if (d <= 720) return 0.175
  return 0.15
}

export function isentoIr(tipoPreset) {
  if (!tipoPreset) return false
  const k = String(tipoPreset).toUpperCase()
  return ['LCA', 'LCI', 'CRA', 'CRI', 'POUPANCA', 'DEBENTURE'].includes(k)
}

// ── Rendimento ─────────────────────────────────────────────────────────────────

function taxaEfetivaAa(percentualCdi, cdiAa, tipoIndexador) {
  if (tipoIndexador === 'PREFIXADO') return Number(percentualCdi)
  return (Number(percentualCdi) / 100) * Number(cdiAa)
}

/**
 * Calcula rendimento de um único aporte.
 * @returns {{ bruto, liquido, brutoAcum, liquidoAcum, aliquota, isento, diasUteis, diasCorr }}
 */
function calcAporte(valor, percentualCdi, cdiAa, tipoIndexador, tipoPreset, dataAquisicao) {
  const v = Number(valor)
  const du = contarDiasUteis(dataAquisicao)
  const dc = diasCorridos(dataAquisicao)
  const te = taxaEfetivaAa(percentualCdi, cdiAa, tipoIndexador)
  const isento = isentoIr(tipoPreset)

  // Rendimento diário
  const bruto = v * (Math.pow(1 + te / 100, 1 / DIAS_UTEIS_ANO) - 1)
  const aliq = isento ? 0 : aliquotaIr(dc)
  const liquido = bruto * (1 - aliq)

  // Rendimento acumulado (juros compostos)
  const brutoAcum = v * (Math.pow(1 + te / 100, du / DIAS_UTEIS_ANO) - 1)
  const liquidoAcum = brutoAcum * (1 - aliq)

  return { bruto, liquido, brutoAcum, liquidoAcum, aliquota: aliq, isento, diasUteis: du, diasCorr: dc }
}

/**
 * Calcula rendimento de um investimento (com múltiplos aportes).
 */
export function calcularRendimentoInvestimento(inv, cdiAa) {
  const { percentual_cdi, tipo_indexador, tipo_preset, aportes } = inv

  if (!cdiAa && tipo_indexador !== 'PREFIXADO') {
    return null
  }

  const aportesList = (aportes || []).filter((a) => Number(a.valor) > 0 && a.data_aquisicao)

  if (aportesList.length === 0) {
    const valor = Number(inv.valor_investido) || 0
    if (!valor) return null
    return calcAporte(valor, percentual_cdi, cdiAa, tipo_indexador, tipo_preset, inv.data_aquisicao)
  }

  let bruto = 0, liquido = 0, brutoAcum = 0, liquidoAcum = 0
  let duTotal = 0, dcTotal = 0
  let isento = false

  for (const ap of aportesList) {
    const r = calcAporte(Number(ap.valor), percentual_cdi, cdiAa, tipo_indexador, tipo_preset, ap.data_aquisicao)
    bruto += r.bruto
    liquido += r.liquido
    brutoAcum += r.brutoAcum
    liquidoAcum += r.liquidoAcum
    duTotal = Math.max(duTotal, r.diasUteis)
    dcTotal = Math.max(dcTotal, r.diasCorr)
    isento = r.isento
  }

  // Alíquota efetiva ponderada (IR total / rendimento bruto acumulado). Antes
  // retornava a alíquota do ÚLTIMO aporte iterado — enganoso quando os aportes
  // têm datas distintas (faixas regressivas diferentes).
  const aliquota = brutoAcum > 0 ? (brutoAcum - liquidoAcum) / brutoAcum : 0

  return { bruto, liquido, brutoAcum, liquidoAcum, aliquota, isento, diasUteis: duTotal, diasCorr: dcTotal }
}
