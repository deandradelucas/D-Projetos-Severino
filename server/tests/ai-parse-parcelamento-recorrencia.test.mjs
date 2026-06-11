import { describe, expect, it } from 'vitest'
import { sanitizeTransacaoExtraidaIA } from '../lib/ai-whatsapp.mjs'
import { isListaComprasMessage } from '../lib/domain/lista-compras-whatsapp.mjs'

const CATS = [
  {
    id: 'cat-1',
    tipo: 'DESPESA',
    nome: 'Compras e Varejo',
    subcategorias: [{ id: 'sub-1', nome: 'Roupas' }],
  },
]

describe('sanitizeTransacaoExtraidaIA — parcelamento/recorrência', () => {
  it('aceita parcelamento válido (2-120)', () => {
    const r = sanitizeTransacaoExtraidaIA(
      { tipo: 'DESPESA', valor: 300, descricao: 'Tênis', categoria_id: 'cat-1', parcelamento: { num_parcelas: 3 } },
      CATS,
    )
    expect(r.parcelamento).toEqual({ num_parcelas: 3 })
    expect(r.recorrencia).toBeNull()
  })

  it('descarta parcelamento fora do range e tipos inválidos', () => {
    for (const num_parcelas of [1, 0, -2, 121, 'abc', null]) {
      const r = sanitizeTransacaoExtraidaIA(
        { tipo: 'DESPESA', valor: 100, categoria_id: 'cat-1', parcelamento: { num_parcelas } },
        CATS,
      )
      expect(r.parcelamento).toBeNull()
    }
  })

  it('aceita recorrência válida e normaliza frequência p/ maiúsculas', () => {
    const r = sanitizeTransacaoExtraidaIA(
      { tipo: 'DESPESA', valor: 1200, categoria_id: 'cat-1', recorrencia: { quantidade: 12, frequencia: 'mensal' } },
      CATS,
    )
    expect(r.recorrencia).toEqual({ quantidade: 12, frequencia: 'MENSAL' })
  })

  it('descarta recorrência com frequência desconhecida', () => {
    const r = sanitizeTransacaoExtraidaIA(
      { tipo: 'DESPESA', valor: 100, categoria_id: 'cat-1', recorrencia: { quantidade: 6, frequencia: 'DIARIA' } },
      CATS,
    )
    expect(r.recorrencia).toBeNull()
  })

  it('exclusão mútua: parcelamento vence quando a IA retorna os dois', () => {
    const r = sanitizeTransacaoExtraidaIA(
      {
        tipo: 'DESPESA', valor: 300, categoria_id: 'cat-1',
        parcelamento: { num_parcelas: 3 },
        recorrencia: { quantidade: 12, frequencia: 'MENSAL' },
      },
      CATS,
    )
    expect(r.parcelamento).toEqual({ num_parcelas: 3 })
    expect(r.recorrencia).toBeNull()
  })

  it('normaliza também quando a categoria é inválida (early-return)', () => {
    const r = sanitizeTransacaoExtraidaIA(
      { tipo: 'DESPESA', valor: 300, categoria_id: 'nao-existe', parcelamento: { num_parcelas: '4' } },
      CATS,
    )
    expect(r.categoria_id).toBeNull()
    expect(r.parcelamento).toEqual({ num_parcelas: 4 })
  })
})

describe('isListaComprasMessage — remover/marcar/tarefas', () => {
  it('detecta remover e marcar como comprado', () => {
    expect(isListaComprasMessage('tira o leite da lista')).toBe(true)
    expect(isListaComprasMessage('remove arroz e feijão da lista Mercado')).toBe(true)
    expect(isListaComprasMessage('risca o sabão da lista')).toBe(true)
    expect(isListaComprasMessage('comprei o arroz da lista Mercado')).toBe(true)
    expect(isListaComprasMessage('marca o leite como comprado')).toBe(true)
  })

  it('detecta criação de lista de tarefas', () => {
    expect(isListaComprasMessage('cria uma lista de tarefas chamada Casa')).toBe(true)
  })

  it('NÃO sequestra transações comuns', () => {
    expect(isListaComprasMessage('comprei 50 de arroz')).toBe(false)
    expect(isListaComprasMessage('gastei 200 no mercado')).toBe(false)
    expect(isListaComprasMessage('comprei um tênis em 3x de 100')).toBe(false)
  })
})
