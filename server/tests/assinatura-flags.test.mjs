import { describe, it, expect } from 'vitest'
import { asaasSubscriptionBloqueiaAcesso, computeAssinaturaFlags, mpStatusBloqueiaAcesso } from '../lib/assinatura.mjs'

const futureIso = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const pastIso = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

describe('asaasSubscriptionBloqueiaAcesso / mpStatusBloqueiaAcesso (alias)', () => {
  it('bloqueia inactive e expired', () => {
    expect(asaasSubscriptionBloqueiaAcesso('inactive')).toBe(true)
    expect(asaasSubscriptionBloqueiaAcesso('INACTIVE')).toBe(true)
    expect(asaasSubscriptionBloqueiaAcesso('expired')).toBe(true)
    expect(asaasSubscriptionBloqueiaAcesso('EXPIRED')).toBe(true)
    expect(mpStatusBloqueiaAcesso('inactive')).toBe(true)
  })
  it('não bloqueia vazio ou active', () => {
    expect(asaasSubscriptionBloqueiaAcesso('')).toBe(false)
    expect(asaasSubscriptionBloqueiaAcesso(null)).toBe(false)
    expect(asaasSubscriptionBloqueiaAcesso('active')).toBe(false)
    expect(asaasSubscriptionBloqueiaAcesso('ACTIVE')).toBe(false)
  })
})

describe('computeAssinaturaFlags', () => {
  it('super-admin: acesso total e situacao admin', () => {
    const f = computeAssinaturaFlags({
      email: 'mestredamente@mestredamente.com',
      isento_pagamento: false,
      trial_ends_at: pastIso(),
      bem_vindo_pagamento_visto_at: null,
      assinatura_paga: false,
      assinatura_asaas_status: 'INACTIVE',
    })
    expect(f.acesso_app_liberado).toBe(true)
    expect(f.assinatura_situacao).toBe('admin')
    expect(f.assinatura_asaas_bloqueada).toBe(false)
  })

  it('isento: situacao isento', () => {
    const f = computeAssinaturaFlags({
      email: 'user@example.com',
      isento_pagamento: true,
      trial_ends_at: null,
      bem_vindo_pagamento_visto_at: null,
      assinatura_paga: false,
      assinatura_asaas_status: null,
    })
    expect(f.assinatura_situacao).toBe('isento')
    expect(f.acesso_app_liberado).toBe(true)
  })

  it('trial ativo sem pagamento: situacao trial', () => {
    const f = computeAssinaturaFlags({
      email: 'user@example.com',
      isento_pagamento: false,
      trial_ends_at: futureIso(),
      bem_vindo_pagamento_visto_at: null,
      assinatura_paga: false,
      assinatura_asaas_status: null,
    })
    expect(f.assinatura_situacao).toBe('trial')
    expect(f.acesso_app_liberado).toBe(true)
    expect(f.assinatura_asaas_bloqueada).toBe(false)
  })

  it('pagamento efetivo e assinatura ACTIVE: ativo', () => {
    const f = computeAssinaturaFlags({
      email: 'user@example.com',
      isento_pagamento: false,
      trial_ends_at: pastIso(),
      bem_vindo_pagamento_visto_at: '2020-01-01T00:00:00.000Z',
      assinatura_paga: true,
      assinatura_asaas_status: 'ACTIVE',
    })
    expect(f.assinatura_situacao).toBe('ativo')
    expect(f.assinatura_paga).toBe(true)
    expect(f.acesso_app_liberado).toBe(true)
  })

  it('Assaas inactive e trial encerrado: bloqueia acesso', () => {
    const f = computeAssinaturaFlags({
      email: 'user@example.com',
      isento_pagamento: false,
      trial_ends_at: pastIso(),
      bem_vindo_pagamento_visto_at: null,
      assinatura_paga: true,
      assinatura_asaas_status: 'INACTIVE',
    })
    expect(f.acesso_app_liberado).toBe(false)
    expect(f.assinatura_situacao).toBe('pausada')
    expect(f.assinatura_asaas_bloqueada).toBe(true)
    expect(f.motivo_bloqueio_acesso).toMatch(/pausada/i)
  })

})
