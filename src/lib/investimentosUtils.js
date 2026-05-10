import { extrairYyyyMmDdReferencia } from './investimentosRendimentoIr'

export function ymdLocalFromDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ymdMaxProjecaoLocal() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 50)
  return ymdLocalFromDate(d)
}

export function formatYmdPtBr(ymd) {
  if (!ymd) return ''
  try {
    return new Date(`${ymd}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ymd
  }
}

export function isoParaCalculoDias(dataAquisicao, criadoEm) {
  const da = extrairYyyyMmDdReferencia(dataAquisicao)
  if (da) return `${da}T12:00:00`
  const dc = extrairYyyyMmDdReferencia(criadoEm)
  if (dc) return `${dc}T12:00:00`
  return criadoEm
}
