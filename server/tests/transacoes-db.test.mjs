import { describe, it, expect, vi, beforeEach } from 'vitest'
import { inserirTransacao } from '../lib/transacoes.mjs'
import * as SupabaseAdmin from '../lib/supabase-admin.mjs'

// Mock do Supabase
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSupabase = {
  from: vi.fn(() => ({
    insert: mockInsert.mockReturnValue({
      select: mockSelect
    })
  }))
}

vi.mock('../lib/supabase-admin.mjs', () => ({
  getSupabaseAdmin: () => mockSupabase
}))

describe('transacoes.mjs - inserirTransacao', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve lançar erro se o valor for inválido', async () => {
    await expect(inserirTransacao({ valor: 0 })).rejects.toThrow('Valor inválido.')
    await expect(inserirTransacao({ valor: -10 })).rejects.toThrow('Valor inválido.')
    await expect(inserirTransacao({ valor: 'abc' })).rejects.toThrow('Valor inválido.')
  })

  it('deve inserir uma transação simples corretamente', async () => {
    mockSelect.mockResolvedValue({ data: [{ id: '123' }], error: null })

    const payload = {
      usuario_id: 'user-1',
      tipo: 'DESPESA',
      valor: 100.50,
      descricao: 'Teste',
      data_transacao: '2026-04-27T10:00:00Z'
    }

    const result = await inserirTransacao(payload)

    expect(mockSupabase.from).toHaveBeenCalledWith('transacoes')
    expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({
      usuario_id: 'user-1',
      valor: 100.50,
      descricao: 'Teste'
    })])
    expect(result.id).toBe('123')
  })
})
