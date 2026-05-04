import { describe, expect, it } from 'vitest'
import { boundsExtratoISO, detectExtratoPedido } from '../lib/domain/whatsapp-extrato.mjs'

describe('detectExtratoPedido', () => {
  it('detecta histórico de gastos do dia de hoje', () => {
    const d = detectExtratoPedido('Mande meu histórico de gastos do dia de hoje')
    expect(d).toEqual({ periodo: 'dia', tipo: 'DESPESA' })
  })

  it('detecta extrato do mês com receitas e despesas (ambos)', () => {
    const d = detectExtratoPedido('extrato do mês')
    expect(d?.periodo).toBe('mes')
    expect(d?.tipo).toBe('ambos')
  })

  it('detecta movimentação da semana', () => {
    const d = detectExtratoPedido('movimentação financeira da semana')
    expect(d?.periodo).toBe('semana')
    expect(d?.tipo).toBe('ambos')
  })

  it('quanto gastei hoje → despesa dia', () => {
    const d = detectExtratoPedido('quanto gastei hoje')
    expect(d).toEqual({ periodo: 'dia', tipo: 'DESPESA' })
  })

  it('não confunde com mensagem aleatória', () => {
    expect(detectExtratoPedido('oi tudo bem')).toBe(null)
  })
})

describe('boundsExtratoISO', () => {
  it('dia usa calendário em São Paulo', () => {
    const base = new Date('2026-05-04T17:00:00.000Z')
    const { dataInicio, dataFim, label } = boundsExtratoISO('dia', base)
    expect(label).toBe('04/05/2026')
    expect(new Date(dataInicio).getTime()).toBeLessThan(new Date(dataFim).getTime())
  })

  it('mês de maio 2026 cobre maio inteiro', () => {
    const base = new Date('2026-05-04T12:00:00.000Z')
    const { dataInicio, dataFim, label } = boundsExtratoISO('mes', base)
    expect(label).toBe('05/2026')
    expect(dataInicio).toMatch(/^2026-05-01T03:00:00/)
    const ms = new Date(dataFim).getTime() - new Date(dataInicio).getTime()
    expect(ms).toBeGreaterThan(25 * 24 * 60 * 60 * 1000)
    expect(ms).toBeLessThan(35 * 24 * 60 * 60 * 1000)
  })
})
