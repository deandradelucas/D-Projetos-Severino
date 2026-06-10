import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

/* Testa as proteções adicionadas na auditoria de 10/jun (commit 02f0390):
 * rate limit nos endpoints de OTP/senha do perfil e revogação de sessões
 * após troca de senha. Tudo mockado — sem banco, sem e-mail/WhatsApp. */

const state = {
  rateLimitAllow: true,
  rateLimitCalls: [],
  perfil: { id: 'u1', email: 'user@x.com', telefone: '51999990000', email_verificado: false, telefone_verificado: false },
  senhaOk: true,
  revogadas: [],
  otpEnviados: [],
}

vi.mock('../lib/rate-limit.mjs', () => ({
  rateLimitTake: vi.fn(async (key) => {
    state.rateLimitCalls.push(key)
    return state.rateLimitAllow
  }),
  clientKeyFromHono: () => '203.0.113.9',
}))

vi.mock('../lib/http/resolve-request-user-id.mjs', () => ({
  resolveRequestUserId: () => 'u1',
}))

vi.mock('../lib/assinatura.mjs', () => ({
  assertAcessoAppUsuario: vi.fn(async () => null),
}))

vi.mock('../lib/usuarios.mjs', () => ({
  getPerfilUsuario: vi.fn(async () => state.perfil),
  atualizarTelefoneUsuario: vi.fn(),
  atualizarNomeUsuario: vi.fn(),
  atualizarAvatarUsuario: vi.fn(),
  atualizarPreferenciasUsuario: vi.fn(),
  exportarDadosUsuario: vi.fn(),
  solicitarExclusaoConta: vi.fn(),
  revogarSessoesUsuario: vi.fn(async (uid) => { state.revogadas.push(uid) }),
  contarSessoesUsuario: vi.fn(async () => 1),
}))

vi.mock('../lib/email-otp.mjs', () => ({
  sendEmailOtp: vi.fn(async (uid, email) => { state.otpEnviados.push(['email', email]); return { masked: 'us***@x.com' } }),
  verifyEmailOtp: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../lib/registration-otp.mjs', () => ({
  sendRegistrationOtp: vi.fn(async (uid, tel) => { state.otpEnviados.push(['tel', tel]) }),
  verifyRegistrationOtp: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../lib/password-reset.mjs', () => ({
  authenticateUser: vi.fn(async () => (state.senhaOk ? { id: 'u1' } : null)),
}))

vi.mock('../lib/supabase-admin.mjs', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  }),
}))

const { registerUsuarioPerfilRoutes } = await import('../routes/register-usuario-perfil.mjs')

function buildApp() {
  const app = new Hono()
  registerUsuarioPerfilRoutes(app)
  return app
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

describe('perfil — OTP e senha (rate limit + revogação de sessões)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.rateLimitAllow = true
    state.rateLimitCalls = []
    state.revogadas = []
    state.otpEnviados = []
    state.senhaOk = true
    state.perfil.email_verificado = false
    state.perfil.telefone_verificado = false
  })

  it('enviar-otp de e-mail passa pelo rate limit (IP + usuário) e envia', async () => {
    const app = buildApp()
    const res = await app.request('/api/usuarios/perfil/email/enviar-otp', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(state.rateLimitCalls.some((k) => k.startsWith('perfil-otp-email-send:203.0.113.9'))).toBe(true)
    expect(state.rateLimitCalls.some((k) => k === 'perfil-otp-email-send:u1')).toBe(true)
    expect(state.otpEnviados).toEqual([['email', 'user@x.com']])
  })

  it('enviar-otp bloqueado pelo rate limit → 429 e NÃO envia e-mail', async () => {
    state.rateLimitAllow = false
    const app = buildApp()
    const res = await app.request('/api/usuarios/perfil/email/enviar-otp', { method: 'POST' })
    expect(res.status).toBe(429)
    expect(state.otpEnviados).toEqual([])
  })

  it('verificar OTP de e-mail é rate-limited por usuário', async () => {
    state.rateLimitAllow = false
    const app = buildApp()
    const res = await app.request('/api/usuarios/perfil/email/verificar', json({ codigo: '123456' }))
    expect(res.status).toBe(429)
    expect(state.rateLimitCalls).toContain('perfil-otp-email-verify:u1')
  })

  it('enviar/verificar OTP de telefone usam chaves separadas do canal e-mail', async () => {
    const app = buildApp()
    await app.request('/api/usuarios/perfil/telefone/enviar-otp', { method: 'POST' })
    await app.request('/api/usuarios/perfil/telefone/verificar', json({ codigo: '123456' }))
    expect(state.rateLimitCalls).toContain('perfil-otp-tel-send:u1')
    expect(state.rateLimitCalls).toContain('perfil-otp-tel-verify:u1')
    expect(state.rateLimitCalls.every((k) => !k.includes('email'))).toBe(true)
  })

  it('trocar senha com sucesso REVOGA as sessões do usuário', async () => {
    const app = buildApp()
    const res = await app.request('/api/usuarios/perfil/senha', json({ senhaAtual: 'antiga123', novaSenha: 'novaSenha9' }))
    expect(res.status).toBe(200)
    expect(state.revogadas).toEqual(['u1'])
  })

  it('senha atual errada → 400 e NÃO revoga sessões', async () => {
    state.senhaOk = false
    const app = buildApp()
    const res = await app.request('/api/usuarios/perfil/senha', json({ senhaAtual: 'errada', novaSenha: 'novaSenha9' }))
    expect(res.status).toBe(400)
    expect(state.revogadas).toEqual([])
  })

  it('trocar senha é rate-limited (5/15min por usuário)', async () => {
    state.rateLimitAllow = false
    const app = buildApp()
    const res = await app.request('/api/usuarios/perfil/senha', json({ senhaAtual: 'antiga123', novaSenha: 'novaSenha9' }))
    expect(res.status).toBe(429)
    expect(state.rateLimitCalls).toContain('perfil-senha:u1')
  })

  it('nova senha < 8 chars → 400', async () => {
    const app = buildApp()
    const res = await app.request('/api/usuarios/perfil/senha', json({ senhaAtual: 'antiga123', novaSenha: 'curta12' }))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain('8 caracteres')
  })
})
