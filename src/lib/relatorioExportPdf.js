/**
 * Gerador de PDF do Relatório Analítico — módulo puro, sem DOM.
 *
 * Por que recebemos jsPDF/autoTable por injeção em vez de importar aqui?
 *  - Mantemos `jspdf` (~140 KB gzipped) como chunk lazy disparado só no clique
 *    (ou pré-aquecido on hover). Importar diretamente neste arquivo eliminaria
 *    o lazy load. Veja `Relatorios.jsx#prefetchPdfDeps`.
 *  - Permite testar a montagem do PDF sem instalar/rodar jspdf no Vitest.
 *  - Deixa portátil: a mesma função pode rodar numa Vercel Function se um dia
 *    fizer sentido (PDF assinado, marca d'água do servidor, etc.). Hoje o
 *    trade-off custo/benefício favorece geração no cliente — ver
 *    `docs/decisions/0001-pdf-no-cliente.md`.
 */

/**
 * @typedef {Object} RelatorioSummary
 * @property {number} receitas
 * @property {number} despesas
 * @property {number} saldo
 *
 * @typedef {Object} RelatorioFiltros
 * @property {string} dataInicio  // ISO YYYY-MM-DD
 * @property {string} dataFim     // ISO YYYY-MM-DD
 *
 * @typedef {Object} RelatorioPdfInput
 * @property {Array<Record<string, unknown>>} transacoes
 * @property {RelatorioFiltros} filtros
 * @property {RelatorioSummary} summary
 * @property {(value: unknown) => string} formatCurrency
 */

const COLOR_HEAD_FILL = [44, 62, 80]

/**
 * Monta o documento PDF do relatório.
 *
 * @param {new () => any} JsPdfCtor   Construtor do jsPDF (de `import('jspdf')`).
 * @param {(doc: any, options: any) => void} autoTable  Função `default` de jspdf-autotable.
 * @param {RelatorioPdfInput} input
 * @returns {any} Instância de jsPDF pronta para `.save()` ou `.output()`.
 */
export function buildRelatorioPdfDoc(JsPdfCtor, autoTable, input) {
  const { transacoes = [], filtros, summary, formatCurrency } = input
  const doc = new JsPdfCtor()

  doc.setFontSize(18)
  doc.text('Relatório Analítico de Transações', 14, 22)

  doc.setFontSize(11)
  doc.setTextColor(100)
  const periodoStr = `Período: ${formatDateBr(filtros.dataInicio)} a ${formatDateBr(filtros.dataFim)}`
  doc.text(periodoStr, 14, 30)

  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text(`Total de Receitas: ${formatCurrency(summary.receitas)}`, 14, 40)
  doc.text(`Total de Despesas: ${formatCurrency(summary.despesas)}`, 14, 48)
  doc.text(`Saldo Líquido: ${formatCurrency(summary.saldo)}`, 14, 56)

  const head = [['Data', 'Tipo', 'Categoria', 'Valor', 'Status']]
  const body = transacoes.map((t) => [
    t?.data_transacao ? formatDateBr(t.data_transacao) : '',
    t?.tipo ?? '',
    /** @type {any} */ (t)?.categorias?.nome || 'Sem categoria',
    formatCurrency(/** @type {any} */ (t)?.valor),
    /** @type {any} */ (t)?.status ?? '',
  ])

  autoTable(doc, {
    head,
    body,
    startY: 65,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: COLOR_HEAD_FILL },
  })

  return doc
}

/**
 * Salva o PDF no cliente via `doc.save()`. Em ambiente sem DOM, pular.
 *
 * @param {any} doc
 * @param {RelatorioFiltros} filtros
 */
export function downloadRelatorioPdf(doc, filtros) {
  doc.save(`relatorio_${filtros.dataInicio}_a_${filtros.dataFim}.pdf`)
}

/**
 * @param {string} iso  YYYY-MM-DD ou ISO completo.
 * @returns {string}
 */
function formatDateBr(iso) {
  if (!iso) return ''
  const safe = typeof iso === 'string' && iso.length === 10 ? `${iso}T00:00:00` : iso
  return new Date(safe).toLocaleDateString('pt-BR')
}
