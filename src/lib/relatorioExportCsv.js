function escaparCampoCsv(s) {
  return String(s ?? '').replace(/,/g, '')
}

/**
 * @param {Array<Record<string, unknown>>} transacoes
 * @returns {string}
 */
export function buildRelatorioCsvContent(transacoes) {
  const linhas = ['Data,Tipo,Categoria,Subcategoria,Valor,Status,Descrição']
  for (const t of transacoes || []) {
    const dataStr =
      t.data_transacao != null && t.data_transacao !== ''
        ? new Date(t.data_transacao).toLocaleDateString('pt-BR')
        : ''
    const cat = t.categorias?.nome || ''
    const sub = t.subcategorias?.nome || ''
    const descricao = t.descricao ? escaparCampoCsv(t.descricao) : ''
    linhas.push(
      `${dataStr},${t.tipo ?? ''},${cat},${sub},${t.valor ?? ''},${t.status ?? ''},${descricao}`
    )
  }
  return linhas.join('\n')
}

/**
 * @param {Array<Record<string, unknown>>} transacoes
 * @param {{ dataInicio: string, dataFim: string }} filtros
 */
export function downloadRelatorioCsv(transacoes, filtros) {
  if (!transacoes?.length) return
  const conteudo = buildRelatorioCsvContent(transacoes)
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `relatorio_${filtros.dataInicio}_a_${filtros.dataFim}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(url)
  }
}
