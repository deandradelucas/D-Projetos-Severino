/**
 * Estimativas de rendimento diário ligadas ao CDI e IR regressivo sobre o rendimento (PF).
 * Convenção: pro rata linear em 252 dias úteis sobre taxa efetiva (% CDI contratada × CDI a.a.).
 * CDI incide em dias úteis (não há rendimento em fins de semana — feriados nacionais vedam pregão).
 */

export const DIAS_UTEIS_ANO_RENDIMENTO = 252

/**
 * Extrai calendário `YYYY-MM-DD` de valores vindos da API (DATE, ISO, número ms).
 * Usado em contagens de dias úteis e dias corridos para não falhar com formatos estranhos.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function extrairYyyyMmDdReferencia(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const s = String(raw).trim()
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (head) return head[1]
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    const d = new Date(t)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return null
}

/** @param {number} y */
function domingoPascoalGregorian(y) {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(y, month - 1, day)
}

/** @param {Date} d */
function chaveDataLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Feriados nacionais recorrentes (fixos + Carnaval/Sexta Santa/Corpus Christi). */
function feriadosNacionaisBrKeysParaAno(year) {
  const set = new Set()
  const addMd = (monthIndex0, day) => set.add(chaveDataLocal(new Date(year, monthIndex0, day)))

  addMd(0, 1) // Confraternização
  addMd(3, 21) // Tiradentes
  addMd(4, 1) // Trabalho
  addMd(8, 7) // Independência
  addMd(9, 12) // Nossa Senhora Aparecida
  addMd(10, 2) // Finados
  addMd(10, 15) // Proclamação da República
  addMd(10, 20) // Consciência Negra
  addMd(11, 25) // Natal

  const pascoa = domingoPascoalGregorian(year)
  const addDias = (base, delta) => {
    const x = new Date(base.getFullYear(), base.getMonth(), base.getDate())
    x.setDate(x.getDate() + delta)
    return x
  }
  set.add(chaveDataLocal(addDias(pascoa, -48))) // segunda de Carnaval
  set.add(chaveDataLocal(addDias(pascoa, -47))) // terça de Carnaval
  set.add(chaveDataLocal(addDias(pascoa, -2))) // Sexta-feira Santa
  set.add(chaveDataLocal(addDias(pascoa, 60))) // Corpus Christi (BR)

  return set
}

/** @param {string | undefined | null} iso */
function dataLocalInicioApartirDeIso(iso) {
  const ymd = extrairYyyyMmDdReferencia(iso)
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

/**
 * Conta dias úteis (seg–sex, exceto feriados nacionais) com pregão CDI no intervalo
 * **[data de início, data de referência]** (ambos inclusivos no calendário local).
 * Usado para acumular rendimento estimado desde a data de aquisição até “hoje”.
 *
 * @param {string | undefined | null} iso Data inicial (YYYY-MM-DD ou ISO com prefixo data).
 * @param {Date} [dataReferencia=new Date()] “Hoje” para o corte (date-only no fuso local).
 * @returns {number | null}
 */
export function contarDiasUteisComJurosDesdeIso(iso, dataReferencia = new Date()) {
  const start = dataLocalInicioApartirDeIso(iso)
  if (!start) return null
  const end = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), dataReferencia.getDate())
  if (end < start) return 0

  /** @type {Map<number, Set<string>>} */
  const cache = new Map()
  const feriados = (y) => {
    if (!cache.has(y)) cache.set(y, feriadosNacionaisBrKeysParaAno(y))
    return cache.get(y)
  }

  let n = 0
  const walk = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  while (walk <= end) {
    const dow = walk.getDay()
    const isWeekday = dow >= 1 && dow <= 5
    const k = chaveDataLocal(walk)
    const fer = feriados(walk.getFullYear())
    if (isWeekday && !fer.has(k)) n += 1
    walk.setDate(walk.getDate() + 1)
  }
  return n
}

/**
 * Indica se a data (por defeito “hoje”, fuso local do dispositivo) é dia com pregão CDI:
 * segunda a sexta e fora dos feriados nacionais considerados em {@link contarDiasUteisComJurosDesdeIso}.
 *
 * @param {Date} [dataReferencia=new Date()]
 * @returns {boolean}
 */
export function ehDiaUtilComPregaoCdi(dataReferencia = new Date()) {
  const d = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), dataReferencia.getDate())
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return false
  const k = chaveDataLocal(d)
  return !feriadosNacionaisBrKeysParaAno(d.getFullYear()).has(k)
}

/** Linhas da tabela regressiva (UI + mesmas faixas de {@link aliquotaIrRendaFixaPfPorPrazoDias}). */
export const IR_RENDA_FIXA_REGRESSIVO_UI = [
  { prazo: 'Até 180 dias', aliquota: '22,5%' },
  { prazo: 'De 181 a 360 dias', aliquota: '20%' },
  { prazo: 'De 361 a 720 dias', aliquota: '17,5%' },
  { prazo: 'Acima de 720 dias', aliquota: '15%' },
]

/**
 * Alíquota do IR sobre o rendimento (pessoa física, renda fixa tributada).
 * @param {number} dias corridos entre aplicação e resgate — aqui usamos proxy pela data de registo.
 * @returns {number} fração decimal (ex.: 0,225)
 */
export function aliquotaIrRendaFixaPfPorPrazoDias(dias) {
  const d = Math.max(0, Math.floor(Number(dias)) || 0)
  if (d <= 180) return 0.225
  if (d <= 360) return 0.2
  if (d <= 720) return 0.175
  return 0.15
}

/**
 * @param {string | undefined | null} iso
 * @returns {number | null} dias corridos desde iso até “hoje” (timezone local), ou null se inválido
 */
export function diasCorridosDesdeIso(iso) {
  const ymd = extrairYyyyMmDdReferencia(iso)
  if (!ymd) return null
  const [y, mo, d] = ymd.split('-').map(Number)
  const start = new Date(y, mo - 1, d)
  if (Number.isNaN(start.getTime())) return null
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ms = end.getTime() - start.getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

/** % a.a. efetiva contratada (ex.: 100% CDI × 14,4% CDI = 14,4%). */
export function taxaEfetivaAaContratada(percentualCdi, cdiAa) {
  return (Number(percentualCdi) / 100) * Number(cdiAa)
}

export function rendimentoBrutoDiarioEstimado(valor, percentualCdi, cdiAa) {
  const v = Number(valor)
  const te = taxaEfetivaAaContratada(percentualCdi, cdiAa)
  return (v * (te / 100)) / DIAS_UTEIS_ANO_RENDIMENTO
}

export function formatAliquotaIrPtBr(decimal) {
  const pct = decimal * 100
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: decimal === 0 ? 0 : 1, maximumFractionDigits: 2 })}%`
}

/** Valores diários muito pequenos: evita mostrar R$ 0,00 quando o rendimento positivo é ínfimo. */
export function formatMoedaDiariaEstimativa(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return '—'
  const rounded2 = Math.round(n * 100) / 100
  if (rounded2 === 0 && n > 0) return '< R$ 0,01'
  if (rounded2 === 0 && n < 0) return '> -R$ 0,01'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

/**
 * @param {number} valor
 * @param {number} percentualCdi
 * @param {number} cdiAa
 * @param {number | null} diasPrazo — se null, usa 0 (faixa mais conservadora)
 * @param {boolean} isentoIrPf
 * @returns {object | null}
 */
export function estimativaRendimentoDiarioComIr(valor, percentualCdi, cdiAa, diasPrazo, isentoIrPf) {
  const v = Number(valor)
  if (!Number.isFinite(v) || v <= 0) return null
  const p = Number(percentualCdi)
  if (!Number.isFinite(p) || p <= 0) return null
  const cdi = Number(cdiAa)
  if (!Number.isFinite(cdi) || cdi <= 0) return null

  const bruto = rendimentoBrutoDiarioEstimado(v, p, cdi)
  if (isentoIrPf) {
    return {
      bruto,
      aliquota: 0,
      aliquotaFmt: 'Isento (PF)',
      imposto: 0,
      liquido: bruto,
      isento: true,
    }
  }
  const d = diasPrazo == null ? 0 : Math.max(0, Math.floor(diasPrazo))
  const aliq = aliquotaIrRendaFixaPfPorPrazoDias(d)
  const imposto = bruto * aliq
  return {
    bruto,
    aliquota: aliq,
    aliquotaFmt: formatAliquotaIrPtBr(aliq),
    imposto,
    liquido: bruto - imposto,
    isento: false,
    diasPrazoUsados: d,
  }
}

/**
 * Rendimento acumulado estimado: (valor diário bruto × dias úteis) com IR sobre o bruto acumulado
 * usando a alíquota regressiva atual pelo prazo em dias corridos (aproximação; CDI e capital constantes).
 *
 * @param {number | null | undefined} diasUteisAcumulacao resultado de {@link contarDiasUteisComJurosDesdeIso}
 */
export function estimativaRendimentoAcumuladoAteHoje(
  valor,
  percentualCdi,
  cdiAa,
  diasPrazoIr,
  isentoIrPf,
  diasUteisAcumulacao,
) {
  const du = Math.max(0, Math.floor(Number(diasUteisAcumulacao)) || 0)
  const daily = estimativaRendimentoDiarioComIr(valor, percentualCdi, cdiAa, diasPrazoIr, isentoIrPf)
  if (!daily) return null
  const brutoAcum = daily.bruto * du
  if (daily.isento) {
    return {
      brutoAcumulado: brutoAcum,
      impostoAcumulado: 0,
      liquidoAcumulado: brutoAcum,
      diasUteisAcumulacao: du,
      aliquotaFmt: daily.aliquotaFmt,
      isento: true,
    }
  }
  const impostoAcum = brutoAcum * daily.aliquota
  return {
    brutoAcumulado: brutoAcum,
    impostoAcumulado: impostoAcum,
    liquidoAcumulado: brutoAcum - impostoAcum,
    diasUteisAcumulacao: du,
    aliquota: daily.aliquota,
    aliquotaFmt: daily.aliquotaFmt,
    isento: false,
  }
}

export function investimentoIsentoIrPessoaFisica(tipoPreset) {
  if (tipoPreset == null || String(tipoPreset).trim() === '') return false
  const k = String(tipoPreset).toUpperCase()
  return k === 'LCA' || k === 'LCI'
}
