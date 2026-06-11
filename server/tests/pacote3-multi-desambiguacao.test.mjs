import { describe, expect, it } from 'vitest'
import { sanitizeTransacaoExtraidaIA } from '../lib/ai-whatsapp.mjs'
import { valorVerbalAmbiguo } from '../lib/domain/whatsapp-bot.mjs'
import { setPendente, getPendente, clearPendente } from '../lib/domain/wa-pendente.mjs'

const CATS = [
  { id: 'cat-ali', tipo: 'DESPESA', nome: 'Alimentação', subcategorias: [{ id: 'sub-mer', nome: 'Supermercado' }] },
  { id: 'cat-sau', tipo: 'DESPESA', nome: 'Saúde', subcategorias: [{ id: 'sub-med', nome: 'Medicamentos' }] },
]

describe('sanitizeTransacaoExtraidaIA — tipo MULTIPLO', () => {
  it('sanitiza cada transação do array e mantém as válidas', () => {
    const r = sanitizeTransacaoExtraidaIA(
      {
        tipo: 'MULTIPLO',
        transacoes: [
          { tipo: 'DESPESA', valor: 50, descricao: 'Mercado', categoria_id: 'cat-ali' },
          { tipo: 'DESPESA', valor: 30, descricao: 'Farmácia', categoria_id: 'cat-sau' },
        ],
      },
      CATS,
    )
    expect(r.tipo).toBe('MULTIPLO')
    expect(r.transacoes).toHaveLength(2)
    expect(r.transacoes[0].categoria_id).toBe('cat-ali')
  })

  it('descarta itens inválidos (sem valor, tipo errado, categoria de outro tipo zerada)', () => {
    const r = sanitizeTransacaoExtraidaIA(
      {
        tipo: 'MULTIPLO',
        transacoes: [
          { tipo: 'DESPESA', valor: 50, descricao: 'Mercado', categoria_id: 'cat-ali' },
          { tipo: 'DESPESA', valor: 0, descricao: 'Zerada' },
          { tipo: 'CHAT', valor: 10, descricao: 'Chat' },
          null,
        ],
      },
      CATS,
    )
    expect(r.transacoes).toHaveLength(1)
  })

  it('array vazio quando IA retorna MULTIPLO sem transacoes', () => {
    const r = sanitizeTransacaoExtraidaIA({ tipo: 'MULTIPLO' }, CATS)
    expect(r.transacoes).toEqual([])
  })
})

describe('valorVerbalAmbiguo — confirmação passiva de valor', () => {
  it('detecta padrão "cinco e vinte" com valor em centavos', () => {
    expect(valorVerbalAmbiguo('gastei cinco e vinte no café', 5.20)).toBe(true)
    expect(valorVerbalAmbiguo('paguei dois e cinquenta no pão', 2.50)).toBe(true)
  })

  it('NÃO dispara quando o valor é inteiro (sem centavos)', () => {
    expect(valorVerbalAmbiguo('gastei vinte e cinco no café', 25)).toBe(false)
    expect(valorVerbalAmbiguo('gastei cinco e vinte', 25)).toBe(false)
  })

  it('NÃO dispara sem padrão verbal na mensagem', () => {
    expect(valorVerbalAmbiguo('gastei 5,20 no café', 5.20)).toBe(false)
    expect(valorVerbalAmbiguo('mercado 89,90', 89.90)).toBe(false)
  })
})

describe('wa-pendente — estado de pergunta pendente (fallback memória)', () => {
  it('grava, lê e limpa', async () => {
    const phone = '5511988887777'
    await setPendente(phone, { tipo: 'lista_escolha', intent: 'ADICIONAR_ITENS', candidatas: [{ id: 'a', nome: 'Mercado' }] })
    const p = await getPendente(phone)
    expect(p?.tipo).toBe('lista_escolha')
    expect(p?.candidatas?.[0]?.nome).toBe('Mercado')
    await clearPendente(phone)
    expect(await getPendente(phone)).toBeNull()
  })

  it('telefones diferentes não compartilham pendência', async () => {
    await setPendente('5511900001111', { tipo: 'lista_escolha' })
    expect(await getPendente('5511900002222')).toBeNull()
    await clearPendente('5511900001111')
  })
})
