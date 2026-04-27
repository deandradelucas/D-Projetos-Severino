import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionService } from '../lib/services/transaction-service.mjs'

// Mocks dos módulos de dependência
vi.mock('../lib/transacoes.mjs', () => ({
  inserirTransacao: vi.fn(),
}))

vi.mock('../lib/recorrencias-mensais.mjs', () => ({
  criarRegraRecorrenciaDia1: vi.fn(),
}))

vi.mock('../lib/logger.mjs', () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { inserirTransacao } from '../lib/transacoes.mjs'
import { criarRegraRecorrenciaDia1 } from '../lib/recorrencias-mensais.mjs'

describe('TransactionService.createTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve lançar erro se usuarioId não for fornecido', async () => {
    await expect(TransactionService.createTransaction(null, {})).rejects.toThrow(
      'ID do usuário é obrigatório.'
    )
  })

  it('deve lançar erro se inserirTransacao retornar null', async () => {
    inserirTransacao.mockResolvedValue(null)
    await expect(
      TransactionService.createTransaction('user-123', { tipo: 'DESPESA', valor: 100 })
    ).rejects.toThrow('Falha ao inserir transação.')
  })

  it('deve criar transação simples sem recorrência', async () => {
    const mockTx = { id: 'tx-001', tipo: 'DESPESA', valor: 50 }
    inserirTransacao.mockResolvedValue(mockTx)

    const result = await TransactionService.createTransaction('user-123', {
      tipo: 'DESPESA',
      valor: 50,
      descricao: 'Café',
    })

    expect(inserirTransacao).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: 'user-123', tipo: 'DESPESA', valor: 50 })
    )
    expect(result).toEqual(mockTx)
    expect(criarRegraRecorrenciaDia1).not.toHaveBeenCalled()
  })

  it('deve criar recorrência dia 1 quando sinalizado', async () => {
    const mockTx = { id: 'tx-002', tipo: 'DESPESA', valor: 200 }
    const mockTxAtualizada = { ...mockTx, recorrencia_mensal_id: 'rec-123' }
    inserirTransacao.mockResolvedValue(mockTx)
    criarRegraRecorrenciaDia1.mockResolvedValue({ transacaoAtualizada: mockTxAtualizada })

    const result = await TransactionService.createTransaction('user-456', {
      tipo: 'DESPESA',
      valor: 200,
      recorrencia_dia_1: true,
    })

    expect(criarRegraRecorrenciaDia1).toHaveBeenCalledWith('user-456', mockTx)
    expect(result.recorrencia_mensal_id).toBe('rec-123')
  })

  it('deve degradar graciosamente se criarRegraRecorrenciaDia1 falhar', async () => {
    const mockTx = { id: 'tx-003', tipo: 'RECEITA', valor: 1500 }
    inserirTransacao.mockResolvedValue(mockTx)
    criarRegraRecorrenciaDia1.mockRejectedValue(new Error('Banco offline'))

    // Não deve lançar — transação já foi salva
    const result = await TransactionService.createTransaction('user-789', {
      tipo: 'RECEITA',
      valor: 1500,
      recorrencia_dia_1: true,
    })

    expect(result).toEqual(mockTx) // retorna a transação original sem o id de recorrência
  })
})
