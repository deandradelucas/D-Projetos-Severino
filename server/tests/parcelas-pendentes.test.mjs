import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hojeYmdBrt } from '../lib/date-brt.mjs'

/** Mock chainable do Supabase que grava os filtros aplicados. */
const calls = {}
const mockChain = {
  update: vi.fn((payload) => { calls.update = payload; return mockChain }),
  eq: vi.fn((col, val) => { calls.eq = [col, val]; return mockChain }),
  not: vi.fn((col, op, val) => { calls.not = [col, op, val]; return mockChain }),
  lte: vi.fn((col, val) => { calls.lte = [col, val]; return mockChain }),
  select: vi.fn(async () => calls.selectResult),
}
const mockSupabase = { from: vi.fn(() => mockChain) }

vi.mock('../lib/supabase-admin.mjs', () => ({
  getSupabaseAdmin: () => mockSupabase,
}))

const { processarParcelasPendentes } = await import('../lib/parcelas-pendentes.mjs')

describe('processarParcelasPendentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    calls.selectResult = { data: [], error: null }
  })

  it('ativa só PENDENTE de parcelamento (recorrente_grupo_id não-nulo)', async () => {
    await processarParcelasPendentes()
    expect(mockSupabase.from).toHaveBeenCalledWith('transacoes')
    expect(calls.update).toEqual({ status: 'EFETIVADA' })
    expect(calls.eq).toEqual(['status', 'PENDENTE'])
    expect(calls.not).toEqual(['recorrente_grupo_id', 'is', null])
  })

  it('corte de vencimento é o FIM DO DIA em BRT, não UTC', async () => {
    await processarParcelasPendentes()
    const [col, limite] = calls.lte
    expect(col).toBe('data_transacao')
    // fim do dia BRT de hoje: YYYY-MM-DDT23:59:59.999-03:00 — às 21h+ BRT o UTC já
    // virou o dia seguinte; usar UTC ativava parcelas 1 dia cedo (bug auditoria jun/2026).
    expect(limite).toBe(`${hojeYmdBrt()}T23:59:59.999-03:00`)
    expect(limite).toMatch(/T23:59:59\.999-03:00$/)
  })

  it('retorna contagem e linhas ativadas', async () => {
    const linhas = [
      { id: 1, descricao: 'TV 3/10', recorrente_index: 3, recorrente_total: 10, usuario_id: 'u1', valor: 100 },
      { id: 2, descricao: 'TV 4/10', recorrente_index: 4, recorrente_total: 10, usuario_id: 'u1', valor: 100 },
    ]
    calls.selectResult = { data: linhas, error: null }
    const r = await processarParcelasPendentes()
    expect(r.atualizadas).toBe(2)
    expect(r.parcelas).toEqual(linhas)
  })

  it('retorna zero sem nada para ativar (data null)', async () => {
    calls.selectResult = { data: null, error: null }
    const r = await processarParcelasPendentes()
    expect(r).toEqual({ atualizadas: 0, parcelas: [] })
  })

  it('propaga erro do banco (cron precisa falhar visível, não silenciar)', async () => {
    calls.selectResult = { data: null, error: new Error('db down') }
    await expect(processarParcelasPendentes()).rejects.toThrow('db down')
  })
})
