import { describe, it, expect, vi } from 'vitest'
import { buildRelatorioPdfDoc, downloadRelatorioPdf } from './relatorioExportPdf.js'

/**
 * Mock minimalista do jsPDF: registra todas as chamadas em `calls` e expõe
 * `save` para o teste de download. Não simulamos rendering — só queremos
 * garantir que a função monta o documento na ordem certa, com os dados certos.
 */
function createJsPdfMock() {
  const calls = []
  class JsPdfMock {
    constructor() {
      calls.push(['ctor'])
    }
    setFontSize(n) { calls.push(['setFontSize', n]); return this }
    setTextColor(c) { calls.push(['setTextColor', c]); return this }
    text(t, x, y) { calls.push(['text', t, x, y]); return this }
    save(name) { calls.push(['save', name]); return this }
  }
  return { JsPdfMock, calls }
}

describe('buildRelatorioPdfDoc', () => {
  const filtros = { dataInicio: '2025-01-01', dataFim: '2025-01-31' }
  const summary = { receitas: 1000, despesas: 400, saldo: 600 }
  const formatCurrency = (v) => `R$ ${Number(v).toFixed(2)}`

  it('escreve título, período, totais e chama autoTable com head/body corretos', () => {
    const { JsPdfMock, calls } = createJsPdfMock()
    const autoTable = vi.fn()

    const doc = buildRelatorioPdfDoc(JsPdfMock, autoTable, {
      transacoes: [
        {
          data_transacao: '2025-01-10',
          tipo: 'DESPESA',
          categorias: { nome: 'Mercado' },
          valor: 50,
          status: 'EFETIVADA',
        },
      ],
      filtros,
      summary,
      formatCurrency,
    })

    expect(doc).toBeTruthy()
    expect(autoTable).toHaveBeenCalledTimes(1)

    const [docArg, options] = autoTable.mock.calls[0]
    expect(docArg).toBe(doc)
    expect(options.head).toEqual([['Data', 'Tipo', 'Categoria', 'Valor', 'Status']])
    expect(options.body).toHaveLength(1)
    expect(options.body[0][0]).toMatch(/10\/01\/2025/)
    expect(options.body[0][1]).toBe('DESPESA')
    expect(options.body[0][2]).toBe('Mercado')
    expect(options.body[0][3]).toBe('R$ 50.00')
    expect(options.theme).toBe('grid')
    expect(options.headStyles.fillColor).toEqual([44, 62, 80])

    const titles = calls.filter(([m]) => m === 'text').map(([, t]) => t)
    expect(titles[0]).toBe('Relatório Analítico de Transações')
    expect(titles[1]).toMatch(/01\/01\/2025 a 31\/01\/2025/)
    expect(titles).toEqual(expect.arrayContaining([
      'Total de Receitas: R$ 1000.00',
      'Total de Despesas: R$ 400.00',
      'Saldo Líquido: R$ 600.00',
    ]))
  })

  it('aceita transação com categoria ausente (fallback "Sem categoria")', () => {
    const { JsPdfMock } = createJsPdfMock()
    const autoTable = vi.fn()

    buildRelatorioPdfDoc(JsPdfMock, autoTable, {
      transacoes: [{ data_transacao: '2025-02-15', tipo: 'RECEITA', valor: 100 }],
      filtros,
      summary,
      formatCurrency,
    })

    expect(autoTable.mock.calls[0][1].body[0][2]).toBe('Sem categoria')
  })

  it('aceita lista vazia (body = [])', () => {
    const { JsPdfMock } = createJsPdfMock()
    const autoTable = vi.fn()

    buildRelatorioPdfDoc(JsPdfMock, autoTable, {
      transacoes: [],
      filtros,
      summary,
      formatCurrency,
    })

    expect(autoTable.mock.calls[0][1].body).toEqual([])
  })
})

describe('downloadRelatorioPdf', () => {
  it('chama doc.save com nome derivado dos filtros', () => {
    const save = vi.fn()
    downloadRelatorioPdf({ save }, { dataInicio: '2025-01-01', dataFim: '2025-01-31' })
    expect(save).toHaveBeenCalledWith('relatorio_2025-01-01_a_2025-01-31.pdf')
  })
})
