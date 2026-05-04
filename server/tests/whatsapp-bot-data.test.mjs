import { describe, expect, it } from 'vitest'
import { resolveDataTransacaoParaBot } from '../lib/domain/whatsapp-bot.mjs'

describe('resolveDataTransacaoParaBot', () => {
  it('usa agora quando não há data_transacao', () => {
    const r = resolveDataTransacaoParaBot({ tipo: 'DESPESA', valor: 10 })
    expect(r.explicit).toBe(false)
    expect(Number.isNaN(Date.parse(r.iso))).toBe(false)
  })

  it('usa ISO válido da IA e marca explicit', () => {
    const r = resolveDataTransacaoParaBot({
      tipo: 'DESPESA',
      valor: 10,
      data_transacao: '2026-05-10T15:30:00.000-03:00',
    })
    expect(r.explicit).toBe(true)
    expect(r.iso).toContain('2026-05-10')
  })

  it('ignora string inválida e cai no agora', () => {
    const r = resolveDataTransacaoParaBot({
      tipo: 'DESPESA',
      valor: 10,
      data_transacao: 'não é data',
    })
    expect(r.explicit).toBe(false)
  })
})
