import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockSupabase = { from: mockFrom }

vi.mock('../lib/supabase-admin.mjs', () => ({
  getSupabaseAdmin: () => mockSupabase,
}))

vi.mock('../lib/super-admin.mjs', () => ({
  isSuperAdminEmail: () => false,
}))

vi.mock('../lib/conta-familiar.mjs', () => ({
  resolveEscopoUsuario: vi.fn(async (uid) => ({ dataUsuarioId: uid })),
}))

vi.mock('../lib/pagamentos-asaas.mjs', () => ({
  usuarioTemPagamentoAprovado: vi.fn(async () => false),
}))

vi.mock('../lib/assinatura-db.mjs', () => ({
  isMissingColumnError: () => false,
  rawIsentoPagamento: () => false,
  resolveIsentoPagamentoEscopo: vi.fn(async () => false),
  ensureTrialIniciado: vi.fn(async () => {}),
}))

vi.mock('../lib/logger.mjs', () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { assertAcessoAppUsuario } from '../lib/assinatura-guard.mjs'

function chainSelectMaybeSingle(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  }
  return chain
}

describe('assertAcessoAppUsuario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 503 quando a leitura de usuarios falha (fail-closed)', async () => {
    mockFrom.mockImplementation((table) => {
      if (table === 'usuarios') {
        return chainSelectMaybeSingle({ data: null, error: { message: 'connection refused' } })
      }
      return chainSelectMaybeSingle({ data: null, error: null })
    })

    const result = await assertAcessoAppUsuario('550e8400-e29b-41d4-a716-446655440000')

    expect(result).toEqual({
      status: 503,
      message: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
    })
  })

  it('retorna 401 quando usuario de billing nao existe', async () => {
    let usuariosCalls = 0
    mockFrom.mockImplementation((table) => {
      if (table === 'usuarios') {
        usuariosCalls += 1
        if (usuariosCalls === 1) {
          return chainSelectMaybeSingle({ data: { email: 'user@example.com' }, error: null })
        }
        return chainSelectMaybeSingle({ data: null, error: null })
      }
      return chainSelectMaybeSingle({ data: null, error: null })
    })

    const result = await assertAcessoAppUsuario('550e8400-e29b-41d4-a716-446655440000')

    expect(result).toEqual({ status: 401, message: 'Não autorizado.' })
  })
})
