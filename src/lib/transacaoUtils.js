export function transacaoDiaKey(dataTransacao) {
  if (dataTransacao == null) return ''
  const s = String(dataTransacao).trim()
  if (!s) return ''
  // Data-only (YYYY-MM-DD): sem hora, sem fuso a converter — usa direto.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Timestamp: usa a data LOCAL (mesmo fuso da exibição na lista). Sem isso, uma
  // transação às 21:34 (UTC-3) viraria 00:34 UTC do dia seguinte e cairia no
  // cabeçalho de dia errado (ex.: 05/jun aparecendo sob "Sábado, 6 de jun").
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
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

/**
 * Descrição livre do utilizador — ignora vazio e legado que copiava sub/categoria.
 */
export function transacaoDescricaoEfetiva(transacao) {
  const desc = String(transacao?.descricao || '').trim()
  if (!desc) return ''

  const subRaw = transacao?.subcategorias
  const subNome =
    subRaw && typeof subRaw === 'object' && subRaw.nome && String(subRaw.nome).trim()
      ? String(subRaw.nome).trim()
      : ''
  const catNome =
    transacao?.categorias?.nome && String(transacao.categorias.nome).trim()
      ? String(transacao.categorias.nome).trim()
      : ''

  if (subNome && desc === subNome) return ''
  if (catNome && desc === catNome) return ''
  return desc
}
