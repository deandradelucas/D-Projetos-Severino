import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthPhoneShell from '../components/AuthPhoneShell'
import { apiUrl } from '../lib/apiUrl'
import { prefetchRoute } from '../lazyRoutes'
import { showToast } from '../lib/toastStore'
import { webAuthnSupported, fetchWebAuthnStatus, loginWithWebAuthn } from '../lib/webauthnBrowser'

const REMEMBER_EMAIL_KEY = 'horizonte_financeiro_remember_email'

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(() => {
    try {
      return window.localStorage.getItem(REMEMBER_EMAIL_KEY) || ''
    } catch {
      return ''
    }
  })
  const [senha, setSenha] = useState('')
  const [rememberEmail, setRememberEmail] = useState(() => {
    try {
      return Boolean(window.localStorage.getItem(REMEMBER_EMAIL_KEY))
    } catch {
      return false
    }
  })
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' })
  const [loading, setLoading] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryStep, setRecoveryStep] = useState(1)
  const [otpCode, setOtpCode] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('')
  const [recoveryMsg, setRecoveryMsg] = useState({ text: '', type: '' })
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [hasWebAuthn, setHasWebAuthn] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)

  /* Aquece o chunk do dashboard enquanto o usuário digita — entrada mais rápida após POST /login */
  useEffect(() => {
    prefetchRoute('/dashboard')
    prefetchRoute('/pagamento')
    prefetchRoute('/bem-vindo-assinatura')
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!webAuthnSupported() || !validateEmail(email)) {
        setHasWebAuthn(false)
        return
      }
      try {
        const ok = await fetchWebAuthnStatus(email)
        if (!cancelled) setHasWebAuthn(ok)
      } catch {
        if (!cancelled) setHasWebAuthn(false)
      }
    }
    const t = window.setTimeout(run, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [email])

  useEffect(() => {
    if (!rememberEmail) {
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY)
      return
    }

    if (email) {
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, email)
    }
  }, [email, rememberEmail])

  useEffect(() => {
    if (showRecovery && recoveryStep === 1) {
      setRecoveryEmail(email)
    }
  }, [email, showRecovery, recoveryStep])

  const openRecovery = (event) => {
    event.preventDefault()
    setShowRecovery((prev) => {
      const next = !prev
      if (next) {
        setRecoveryStep(1)
        setOtpCode('')
        setNovaSenha('')
        setConfirmarNovaSenha('')
        setRecoveryMsg({ text: '', type: '' })
        setRecoveryEmail(email)
      }
      return next
    })
  }

  const handleRequestOtp = async () => {
    setRecoveryMsg({ text: '', type: '' })
    const normalized = recoveryEmail.trim().toLowerCase()
    if (!validateEmail(normalized)) {
      setRecoveryMsg({ text: 'Informe um e-mail válido.', type: 'error' })
      return
    }
    setRecoveryLoading(true)
    try {
      const response = await fetch(apiUrl('/api/auth/request-password-otp-whatsapp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setRecoveryMsg({ text: data.message || 'Não foi possível enviar o código.', type: 'error' })
        return
      }
      setRecoveryMsg({ text: data.message || 'Verifique o WhatsApp cadastrado na sua conta.', type: 'success' })
      setRecoveryStep(2)
    } catch {
      setRecoveryMsg({ text: 'Erro ao conectar com o servidor.', type: 'error' })
    } finally {
      setRecoveryLoading(false)
    }
  }

  const handleConfirmReset = async () => {
    setRecoveryMsg({ text: '', type: '' })
    const normalized = recoveryEmail.trim().toLowerCase()
    if (!validateEmail(normalized)) {
      setRecoveryMsg({ text: 'Informe um e-mail válido.', type: 'error' })
      return
    }
    const digits = otpCode.replace(/\D/g, '')
    if (digits.length !== 6) {
      setRecoveryMsg({ text: 'Digite o código de 6 dígitos recebido no WhatsApp.', type: 'error' })
      return
    }
    if (novaSenha.length < 6) {
      setRecoveryMsg({ text: 'A nova senha deve ter no mínimo 6 caracteres.', type: 'error' })
      return
    }
    if (novaSenha !== confirmarNovaSenha) {
      setRecoveryMsg({ text: 'As senhas não coincidem.', type: 'error' })
      return
    }
    setRecoveryLoading(true)
    try {
      const response = await fetch(apiUrl('/api/auth/reset-password-whatsapp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, code: digits, password: novaSenha }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setRecoveryMsg({ text: data.message || 'Não foi possível redefinir a senha.', type: 'error' })
        return
      }
      showToast(data.message || 'Senha alterada. Faça login.', 'success')
      setShowRecovery(false)
      setRecoveryStep(1)
      setSenha('')
      setOtpCode('')
      setNovaSenha('')
      setConfirmarNovaSenha('')
      setRecoveryMsg({ text: '', type: '' })
    } catch {
      setRecoveryMsg({ text: 'Erro ao conectar com o servidor.', type: 'error' })
    } finally {
      setRecoveryLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensagem({ texto: '', tipo: '' })

    if (!validateEmail(email)) {
      setMensagem({ texto: 'E-mail inválido', tipo: 'erro' })
      return
    }

    if (!senha) {
      setMensagem({ texto: 'Preencha a senha', tipo: 'erro' })
      return
    }
    if (senha.length < 6) {
      setMensagem({ texto: 'A senha deve ter no mínimo 6 caracteres', tipo: 'erro' })
      return
    }

    if (rememberEmail) {
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, email)
    } else {
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY)
    }

    setLoading(true)

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: senha,
        }),
      })

      const raw = await response.text()
      let data = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        setMensagem({
          texto:
            'Resposta inválida do servidor. Em produção, confira se a API está no mesmo domínio ou defina VITE_API_URL no build.',
          tipo: 'erro',
        })
        setLoading(false)
        return
      }

      if (!response.ok) {
        showToast(data.message || 'Dados de acesso incorretos.', 'error')
        setLoading(false)
        return
      }

      if (data.user) {
        window.localStorage.setItem('horizonte_user', JSON.stringify(data.user))
      }

      const u = data.user || {}
      navigateAfterLogin(u)
    } catch (err) {
      const net =
        err instanceof TypeError && String(err?.message || '').toLowerCase().includes('fetch')
          ? 'Sem conexão com o servidor. Verifique a internet e se a API está acessível neste endereço.'
          : 'Erro ao conectar com o servidor.'
      setMensagem({ texto: net, tipo: 'erro' })
      setLoading(false)
    }
  }

  const navigateAfterLogin = (u) => {
    const navOpts = { replace: true, state: { freshLogin: true } }
    if (u.mostrar_bem_vindo_assinatura) {
      navigate('/bem-vindo-assinatura', navOpts)
    } else if (u.acesso_app_liberado === false) {
      navigate('/pagamento?expirado=1', navOpts)
    } else {
      navigate('/dashboard', navOpts)
    }
  }

  const handleBiometricLogin = async () => {
    setMensagem({ texto: '', tipo: '' })
    if (!validateEmail(email)) {
      setMensagem({ texto: 'Informe o e-mail cadastrado para usar a biometria.', tipo: 'erro' })
      return
    }
    if (!webAuthnSupported()) {
      setMensagem({
        texto: 'Biometria requer HTTPS (ou localhost) e um navegador compatível no celular.',
        tipo: 'erro',
      })
      return
    }
    setBioLoading(true)
    try {
      const data = await loginWithWebAuthn(email)
      if (data.user) {
        window.localStorage.setItem('horizonte_user', JSON.stringify(data.user))
      }
      const u = data.user || {}
      navigateAfterLogin(u)
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : 'Não foi possível entrar com biometria.',
        tipo: 'erro',
      })
      setBioLoading(false)
    }
  }

  return (
    <AuthPhoneShell
      title="Login"
      headerTitle="Login"
      heroImageSrc="/images/Login/01.avif"
      subtitle="Bem-vindo de volta. Faça login para continuar."
      compact={!showRecovery && !(webAuthnSupported() && hasWebAuthn)}
      footer={
        <>
          Não tem conta?{' '}
          <Link
            to="/cadastro"
            className="cursor-pointer font-semibold text-emerald-600 underline-offset-4 transition hover:text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6" noValidate>
        <label className="block" htmlFor="email">
          <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">E-mail</span>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
              className="w-full rounded-[14px] border border-neutral-200/95 bg-white/75 px-3 py-3 pr-11 text-[12px] text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none backdrop-blur-sm transition placeholder:text-neutral-400 focus:border-emerald-500/65 focus:bg-white focus-visible:ring-2 focus-visible:ring-emerald-400/35 sm:min-h-[46px] sm:px-4 sm:pr-12 sm:text-[13px]"
            />
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 sm:right-4"
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 12a3 3 0 100-6 3 3 0 000 6z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M20 12c0 2-3.5 6-8 6s-8-4-8-6 3.5-6 8-6 8 4 8 6z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
        </label>

        <label className="block" htmlFor="senha">
          <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">Senha</span>
          <div className="relative">
            <input
              id="senha"
              type={showSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="current-password"
              className="w-full rounded-[14px] border border-neutral-200/95 bg-white/75 px-3 py-3 pr-11 text-[12px] text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none backdrop-blur-sm transition placeholder:text-neutral-300 focus:border-emerald-500/65 focus:bg-white focus-visible:ring-2 focus-visible:ring-emerald-400/35 sm:min-h-[46px] sm:px-4 sm:pr-12 sm:text-[13px]"
            />
            <button
              type="button"
              onClick={() => setShowSenha(!showSenha)}
              aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45 sm:right-3"
            >
              {showSenha ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path
                    d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.4 10.4 0 0112 5c5 0 9.3 3.8 10 9-.3 1.8-1 3.5-2 4.9M6.1 6.1C4.3 7.7 3 9.7 2 12c.7 5.2 5 9 10 9 1.6 0 3.1-.4 4.5-1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path
                    d="M2 12s4.5-7 10-7 10 7 10 7-4.5 7-10 7-10-7-10-7z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              )}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-emerald-800 sm:text-[12px]">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-emerald-400/80 bg-white text-emerald-600 accent-emerald-600 focus:ring-emerald-500/35 focus:ring-offset-0"
            />
            <span>Lembrar e-mail</span>
          </label>
          <button
            type="button"
            onClick={openRecovery}
            className="cursor-pointer text-[11px] font-medium text-neutral-800 underline-offset-4 hover:text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 sm:text-[12px]"
          >
            {showRecovery ? 'Fechar recuperação' : 'Esqueceu a senha?'}
          </button>
        </div>

        {showRecovery && (
          <div className="rounded-[16px] border border-neutral-200/90 bg-white/70 p-3 backdrop-blur-md">
            <p className="mb-2 text-[11px] leading-snug text-neutral-600">
              Enviamos um código de <strong>6 dígitos</strong> para o <strong>WhatsApp</strong> cadastrado no seu perfil (mesmo número da conta).
            </p>
            {recoveryStep === 1 ? (
              <div className="space-y-2">
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="E-mail da conta"
                  className="w-full rounded-[12px] border border-neutral-200/95 bg-white px-3 py-2.5 text-[12px] text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-emerald-400/35"
                  autoComplete="email"
                />
                <button
                  type="button"
                  onClick={() => void handleRequestOtp()}
                  disabled={recoveryLoading}
                  className="w-full cursor-pointer rounded-[12px] border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-900 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recoveryLoading ? 'Enviando…' : 'Enviar código no WhatsApp'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Código (6 dígitos)"
                  className="w-full rounded-[12px] border border-neutral-200/95 bg-white px-3 py-2.5 text-[12px] tracking-widest text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-emerald-400/35"
                  autoComplete="one-time-code"
                />
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Nova senha (mín. 6 caracteres)"
                  minLength={6}
                  className="w-full rounded-[12px] border border-neutral-200/95 bg-white px-3 py-2.5 text-[12px] text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-emerald-400/35"
                  autoComplete="new-password"
                />
                <input
                  type="password"
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  placeholder="Confirmar nova senha"
                  minLength={6}
                  className="w-full rounded-[12px] border border-neutral-200/95 bg-white px-3 py-2.5 text-[12px] text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-emerald-400/35"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => void handleConfirmReset()}
                  disabled={recoveryLoading}
                  className="w-full cursor-pointer rounded-[12px] border border-neutral-200/90 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recoveryLoading ? 'Salvando…' : 'Redefinir senha'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryStep(1)
                    setRecoveryMsg({ text: '', type: '' })
                  }}
                  className="w-full cursor-pointer text-[11px] font-medium text-neutral-600 underline-offset-2 hover:underline"
                >
                  Pedir novo código
                </button>
              </div>
            )}
            {recoveryMsg.text ? (
              <div
                className={`mt-2 rounded-[10px] border p-2 text-[11px] ${
                  recoveryMsg.type === 'success'
                    ? 'border-success/35 bg-success/10 text-emerald-800'
                    : 'border-error/35 bg-error/10 text-red-700'
                }`}
              >
                {recoveryMsg.text}
              </div>
            ) : null}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || bioLoading}
          className="min-h-[46px] w-full cursor-pointer rounded-[14px] bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-4 py-3 text-[13px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(16,185,129,0.42)] transition hover:brightness-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[48px] sm:text-[14px]"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        {webAuthnSupported() && hasWebAuthn && (
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={loading || bioLoading}
            className="min-h-[46px] w-full cursor-pointer rounded-[14px] border border-neutral-200/95 bg-white/90 px-4 py-3 text-[12px] font-medium text-neutral-900 backdrop-blur-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[48px] sm:text-[13px]"
          >
            {bioLoading ? 'Abrindo biometria...' : 'Entrar com biometria'}
          </button>
        )}
      </form>

      {mensagem.texto && (
        <div
          className={`mt-4 rounded-[12px] border p-3 text-center text-[11px] sm:text-[12px] ${
            mensagem.tipo === 'sucesso'
              ? 'border-success/35 bg-success/10 text-emerald-800'
              : 'border-error/35 bg-error/10 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      )}
    </AuthPhoneShell>
  )
}
