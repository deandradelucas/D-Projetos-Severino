import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pagamentoStatusBannerClass,
  pagamentoHistoricoStatusPendente,
  computeDescontoAnual,
  computeDiasRestantesTrial,
  trialUrgenciaVariant,
  trialUrgenciaMsg,
  trialProgresso,
  computeEconomiaAnual,
  computeStatusBadge,
} from './pagamentoUi.js'

describe('pagamentoStatusBannerClass', () => {
  it('mapeia success/pending/outros', () => {
    expect(pagamentoStatusBannerClass('success')).toContain('--success')
    expect(pagamentoStatusBannerClass('pending')).toContain('--warning')
    expect(pagamentoStatusBannerClass('whatever')).toContain('--danger')
  })
})

describe('pagamentoHistoricoStatusPendente', () => {
  it('true para estados pendentes do Asaas', () => {
    expect(pagamentoHistoricoStatusPendente('PENDING')).toBe(true)
    expect(pagamentoHistoricoStatusPendente('in_process')).toBe(true)
    expect(pagamentoHistoricoStatusPendente('awaiting_risk_analysis')).toBe(true)
  })
  it('false para vazio/nulo/confirmado', () => {
    expect(pagamentoHistoricoStatusPendente('')).toBe(false)
    expect(pagamentoHistoricoStatusPendente(null)).toBe(false)
    expect(pagamentoHistoricoStatusPendente('CONFIRMED')).toBe(false)
  })
})

describe('computeDescontoAnual', () => {
  it('calcula desconto do anual vs 12x mensal', () => {
    expect(computeDescontoAnual({ mensal: 10, anual: 100 })).toBe(17) // 100 vs 120 → ~16.7 → 17
  })
  it('0 quando anual não compensa', () => {
    expect(computeDescontoAnual({ mensal: 10, anual: 120 })).toBe(0)
    expect(computeDescontoAnual({ mensal: 0, anual: 100 })).toBe(0)
  })
})

describe('computeEconomiaAnual', () => {
  it('economia em R$', () => {
    expect(computeEconomiaAnual({ mensal: 10, anual: 100 })).toBe(20)
  })
  it('nunca negativa', () => {
    expect(computeEconomiaAnual({ mensal: 10, anual: 200 })).toBe(0)
  })
})

describe('computeDiasRestantesTrial', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('null quando não está em trial', () => {
    expect(computeDiasRestantesTrial({ situacao: 'ativo', trialEndsAt: '2026-06-10' })).toBeNull()
  })
  it('null sem data', () => {
    expect(computeDiasRestantesTrial({ situacao: 'trial', trialEndsAt: null })).toBeNull()
  })
  it('arredonda p/ cima dias restantes', () => {
    expect(computeDiasRestantesTrial({ situacao: 'trial', trialEndsAt: '2026-06-05T12:00:00' })).toBe(4)
  })
  it('nunca negativo', () => {
    expect(computeDiasRestantesTrial({ situacao: 'trial', trialEndsAt: '2026-05-20T12:00:00' })).toBe(0)
  })
})

describe('trialUrgenciaVariant', () => {
  it('mapeia faixas', () => {
    expect(trialUrgenciaVariant(null)).toBeNull()
    expect(trialUrgenciaVariant(0)).toBe('critico')
    expect(trialUrgenciaVariant(1)).toBe('critico')
    expect(trialUrgenciaVariant(2)).toBe('aviso')
    expect(trialUrgenciaVariant(3)).toBe('aviso')
    expect(trialUrgenciaVariant(5)).toBe('normal')
  })
})

describe('trialUrgenciaMsg', () => {
  it('mensagens por dia', () => {
    expect(trialUrgenciaMsg(0)).toContain('termina hoje')
    expect(trialUrgenciaMsg(1)).toContain('Último dia')
    expect(trialUrgenciaMsg(3)).toContain('poucos dias')
    expect(trialUrgenciaMsg(7)).toContain('Aproveite')
  })
})

describe('trialProgresso', () => {
  it('0 quando null', () => {
    expect(trialProgresso(null)).toBe(0)
  })
  it('mínimo visual de 6%', () => {
    expect(trialProgresso(7)).toBe(6) // (7-7)/7 = 0 → max(6, 0) = 6
  })
  it('progresso proporcional', () => {
    expect(trialProgresso(0)).toBe(100) // (7-0)/7 = 100
    expect(trialProgresso(3)).toBeCloseTo((4 / 7) * 100, 5)
  })
})

describe('computeStatusBadge', () => {
  it('ativo + pago', () => {
    expect(computeStatusBadge({ situacao: 'ativo', paga: true }, {}, false)).toEqual({ tone: 'ativo', label: 'Assinatura ativa' })
  })
  it('trial', () => {
    expect(computeStatusBadge({ situacao: 'trial' }, {}, false)).toEqual({ tone: 'trial', label: 'Período de teste' })
  })
  it('admin', () => {
    expect(computeStatusBadge({ situacao: 'admin' }, {}, false)).toEqual({ tone: 'ativo', label: 'Administrador' })
  })
  it('conta isenta', () => {
    expect(computeStatusBadge({ situacao: 'inativa' }, { isento_pagamento: true }, false)).toEqual({ tone: 'ativo', label: 'Conta isenta' })
  })
  it('pausada', () => {
    expect(computeStatusBadge({ situacao: 'pausada' }, {}, false)).toEqual({ tone: 'aviso', label: 'Pausada' })
  })
  it('expirado/cancelada → inativa', () => {
    expect(computeStatusBadge({ situacao: 'cancelada' }, {}, false)).toEqual({ tone: 'expirado', label: 'Inativa' })
    expect(computeStatusBadge({ situacao: 'x' }, {}, true)).toEqual({ tone: 'expirado', label: 'Inativa' })
  })
  it('null quando nada se aplica', () => {
    expect(computeStatusBadge({ situacao: 'ativo', paga: false }, {}, false)).toBeNull()
  })
})
