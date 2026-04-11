import { describe, it, expect } from 'vitest'
import { buildRelatorioCsvContent } from './relatorioExportCsv.js'

describe('buildRelatorioCsvContent', () => {
  it('monta cabeçalho e linhas; descrição sem vírgulas (evita quebrar colunas)', () => {
    const csv = buildRelatorioCsvContent([
      {
        data_transacao: '2025-01-10',
        tipo: 'DESPESA',
        categorias: { nome: 'Mercado' },
        subcategorias: { nome: 'Sub' },
        valor: 10,
        status: 'EFETIVADA',
        descricao: 'texto, com vírgulas',
      },
    ])
    const linhas = csv.split('\n')
    expect(linhas[0]).toBe('Data,Tipo,Categoria,Subcategoria,Valor,Status,Descrição')
    expect(linhas[1]).toMatch(/Mercado/)
    expect(linhas[1]).toMatch(/texto com vírgulas$/)
  })

  it('aceita lista vazia', () => {
    expect(buildRelatorioCsvContent([]).split('\n')).toHaveLength(1)
  })
})
