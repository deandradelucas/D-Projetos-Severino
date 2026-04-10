export function transacaoDiaKey(dataTransacao) {
  if (dataTransacao == null) return ''
  const s = String(dataTransacao).trim()
  if (!s) return ''
  const head = s.includes('T') ? s.split('T')[0] : s.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ''
}

/** YYYY-MM a partir da data da transação */
export function transacaoMesKey(dataTransacao) {
  const d = transacaoDiaKey(dataTransacao)
  if (!d) return ''
  return d.slice(0, 7)
}

export function labelMesBr(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  if (!y || !m) return String(ym)
  return new Date(y, m - 1, 15).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

export function tipoNormalizado(tipo) {
  return String(tipo || '').trim().toUpperCase()
}

/** Despesa ligada a regra mensal (dia 1) ou parcelamento — mesmo critério do ícone nas listas */
export function isDespesaRecorrente(t) {
  return (
    tipoNormalizado(t.tipo) === 'DESPESA' &&
    (Boolean(t.recorrencia_mensal_id) || Boolean(t.recorrente_index))
  )
}

export function parseValorTransacao(t) {
  const val = Number(t.valor)
  if (Number.isFinite(val)) return val
  return parseFloat(String(t.valor).replace(',', '.')) || 0
}
