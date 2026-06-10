import { describe, it, expect, vi, beforeEach } from 'vitest'

/* Mocks: o import-service orquestra dedup + categorização + insert; testamos a
 * lógica de dedup/hash/fallback/contagem sem tocar banco nem IA. */

const state = {
  existingHashes: [],
  inserted: [],
  insertFailFor: null,
  aiCats: null,
}

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(async (_col, hashes) => ({
          data: hashes
            .filter((h) => state.existingHashes.includes(h))
            .map((h) => ({ origem_hash: h })),
          error: null,
        })),
      })),
    })),
  })),
}

vi.mock('../lib/supabase-admin.mjs', () => ({
  getSupabaseAdmin: () => mockSupabase,
}))

vi.mock('../lib/transacoes.mjs', () => ({
  getCategorias: vi.fn(async () => [
    {
      id: 'cat-outros-desp', nome: 'Outros', tipo: 'DESPESA',
      subcategorias: [{ id: 'sub-outros-desp', nome: 'Outros' }],
    },
    {
      id: 'cat-outros-rec', nome: 'Outros', tipo: 'RECEITA',
      subcategorias: [{ id: 'sub-outros-rec', nome: 'Outros' }],
    },
    { id: 'cat-mercado', nome: 'Mercado', tipo: 'DESPESA', subcategorias: [] },
  ]),
  inserirTransacao: vi.fn(async (tx) => {
    if (state.insertFailFor && tx.descricao === state.insertFailFor) throw new Error('insert falhou')
    state.inserted.push(tx)
    return { id: `tx-${state.inserted.length}` }
  }),
}))

vi.mock('../lib/ai-category.mjs', () => ({
  suggestCategoriesBatch: vi.fn(async (rows) =>
    state.aiCats ?? rows.map(() => ({ categoria_id: null, subcategoria_id: null }))),
}))

const { importarTransacoes } = await import('../lib/import/import-service.mjs')

const ROW = { data: '2026-06-01', descricao: 'Mercado Zaffari', valor: 150.5, tipo: 'DESPESA' }

describe('importarTransacoes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.existingHashes = []
    state.inserted = []
    state.insertFailFor = null
    state.aiCats = null
  })

  it('exige usuarioId e retorna zeros para lista vazia', async () => {
    await expect(importarTransacoes('', [ROW])).rejects.toThrow('usuarioId obrigatório')
    const r = await importarTransacoes('u1', [])
    expect(r).toEqual({ importadas: 0, ignoradas: 0, erros: 0, despesas: 0, receitas: 0, semCategoria: 0 })
  })

  it('transações idênticas no MESMO extrato têm hashes distintos (counter) e ambas entram', async () => {
    // ex.: dois cafés de R$5 no mesmo dia — dedup ingênua descartaria a segunda
    const r = await importarTransacoes('u1', [ROW, { ...ROW }])
    expect(r.importadas).toBe(2)
    expect(r.ignoradas).toBe(0)
    const hashes = state.inserted.map((t) => t.origem_hash)
    expect(new Set(hashes).size).toBe(2)
  })

  it('linha já importada antes (hash no banco) é ignorada; a nova entra', async () => {
    // 1ª importação para descobrir o hash determinístico da ROW
    await importarTransacoes('u1', [ROW])
    const hashExistente = state.inserted[0].origem_hash
    state.inserted = []
    state.existingHashes = [hashExistente]

    const r = await importarTransacoes('u1', [ROW, { ...ROW, descricao: 'Padaria', valor: 12 }])
    expect(r.ignoradas).toBe(1)
    expect(r.importadas).toBe(1)
    expect(state.inserted[0].descricao).toBe('Padaria')
  })

  it('FITID (OFX) manda no hash: mesma linha com fitid diferente NÃO é duplicata', async () => {
    await importarTransacoes('u1', [{ ...ROW, fitid: 'A1' }])
    const hashA1 = state.inserted[0].origem_hash
    state.inserted = []
    state.existingHashes = [hashA1]

    const r = await importarTransacoes('u1', [{ ...ROW, fitid: 'A1' }, { ...ROW, fitid: 'B2' }])
    expect(r.ignoradas).toBe(1) // A1 já existe
    expect(r.importadas).toBe(1) // B2 entra mesmo com data/descricao/valor iguais
  })

  it('sem sugestão da IA cai em Outros/Outros do tipo certo e conta semCategoria', async () => {
    const r = await importarTransacoes('u1', [ROW, { ...ROW, descricao: 'Salário', tipo: 'RECEITA' }])
    expect(r.semCategoria).toBe(2)
    expect(state.inserted[0].categoria_id).toBe('cat-outros-desp')
    expect(state.inserted[0].subcategoria_id).toBe('sub-outros-desp')
    expect(state.inserted[1].categoria_id).toBe('cat-outros-rec')
  })

  it('sugestão da IA é usada quando existe (sem contar semCategoria)', async () => {
    state.aiCats = [{ categoria_id: 'cat-mercado', subcategoria_id: null }]
    const r = await importarTransacoes('u1', [ROW])
    expect(r.semCategoria).toBe(0)
    expect(state.inserted[0].categoria_id).toBe('cat-mercado')
  })

  it('grava ao meio-dia UTC (anti-virada de dia) e status EFETIVADA', async () => {
    await importarTransacoes('u1', [ROW])
    expect(state.inserted[0].data_transacao).toBe('2026-06-01T12:00:00.000Z')
    expect(state.inserted[0].status).toBe('EFETIVADA')
  })

  it('falha de insert numa linha não derruba o lote: conta em erros e segue', async () => {
    state.insertFailFor = 'Mercado Zaffari'
    const r = await importarTransacoes('u1', [ROW, { ...ROW, descricao: 'Padaria', valor: 12 }])
    expect(r.erros).toBe(1)
    expect(r.importadas).toBe(1)
  })

  it('resumo separa despesas e receitas e traz o período', async () => {
    const r = await importarTransacoes('u1', [
      { ...ROW, data: '2026-06-03' },
      { ...ROW, descricao: 'Pix recebido', tipo: 'RECEITA', data: '2026-06-01' },
    ])
    expect(r.despesas).toBe(1)
    expect(r.receitas).toBe(1)
    expect(r.periodoInicio).toBe('2026-06-01')
    expect(r.periodoFim).toBe('2026-06-03')
  })
})
