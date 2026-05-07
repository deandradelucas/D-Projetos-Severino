import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthPasswordToggleButton from '../components/AuthPasswordToggleButton'
import AuthPhoneShell from '../components/AuthPhoneShell'
import { apiUrl, severinoProdApiMisconfigured } from '../lib/apiUrl'
import { BRAND_ASSETS, BRAND_LOGO_PIXEL_SIZE } from '../lib/brandAssets'
import { prefetchRoute } from '../lazyRoutes'
import { showToast } from '../lib/toastStore'
import { webAuthnSupported, fetchWebAuthnStatus, loginWithWebAuthn } from '../lib/webauthnBrowser'
import { AUTH_SHELL_INPUT_CLASS } from '../lib/authFormClasses'
import { validateEmail } from '../lib/validateEmail'

const REMEMBER_EMAIL_KEY = 'horizonte_financeiro_remember_email'
const FAMILIA_CONVITE_SESSION_KEY = 'severino_familia_convite'

async function aplicarConviteFamiliaAposLogin(user) {
  if (!user?.id) return user
  let token = ''
  try {
    token = window.sessionStorage.getItem(FAMILIA_CONVITE_SESSION_KEY) || ''
  } catch {
    return user
  }
  if (!token.trim()) return user
  try {
    const res = await fetch(apiUrl('/api/familia/aceitar'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(user.id).trim(),
      },
      body: JSON.stringify({ token: token.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      try {
        window.sessionStorage.removeItem(FAMILIA_CONVITE_SESSION_KEY)
      } catch {
        /* ignore */
      }
      const assinRes = await fetch(apiUrl('/api/assinatura/status'), {
        headers: { 'x-user-id': String(user.id).trim() },
        cache: 'no-store',
      })
      const assin = assinRes.ok ? await assinRes.json().catch(() => ({})) : {}
      showToast(data.message || 'Convite familiar aceito.', 'success')
      return { ...user, ...assin }
    }
    showToast(data.message || 'Não foi possível aceitar o convite familiar.', 'warning')
  } catch {
    showToast('Erro de rede ao aceitar convite familiar.', 'warning')
  }
  return user
}

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
  const [formError, setFormError] = useState('')
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
    const t = searchParams.get('convite')?.trim()
    if (!t) return
    try {
      window.sessionStorage.setItem(FAMILIA_CONVITE_SESSION_KEY, t)
    } catch {
      /* ignore */
    }
  }, [searchParams])

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
    setFormError('')

    if (!validateEmail(email)) {
      setFormError('E-mail inválido')
      return
    }

    if (!senha) {
      setFormError('Preencha a senha')
      return
    }
    if (senha.length < 6) {
      setFormError('A senha deve ter no mínimo 6 caracteres')
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
        const endpoint = apiUrl('/api/auth/login')
        const looksHtml = /^\s*</.test(raw)
        setFormError(
          looksHtml
            ? `A API devolveu HTML em vez de JSON. Pedido: ${endpoint}. No Severino não uses VITE_API_URL igual ao site — a API tem de estar noutro host (ex.: https://mestredamente.com). Confirme no separador Rede do navegador.`
            : `Resposta inválida do servidor (não é JSON). Pedido: ${endpoint}. Confirme se a API está no ar e o URL correto.`,
        )
        setLoading(false)
        return
      }

      if (!response.ok) {
        showToast(data.message || 'Dados de acesso incorretos.', 'error')
        setLoading(false)
        return
      }

      let u = data.user || {}
      u = await aplicarConviteFamiliaAposLogin(u)
      if (u?.id) {
        window.localStorage.setItem('horizonte_user', JSON.stringify(u))
      }

      navigateAfterLogin(u)
    } catch (err) {
      const endpoint = apiUrl('/api/auth/login')
      const detail = err instanceof Error ? err.message : String(err)
      const fetchLike =
        err instanceof TypeError &&
        String(detail || '')
          .toLowerCase()
          .match(/fetch|network|failed|load/i)
      const sslHint =
        typeof window !== 'undefined' && window.location.protocol === 'http:'
          ? ' Force HTTPS no domínio do Severino (SSL na Hostinger); em HTTP o navegador pode bloquear o pedido à API.'
          : ''
      setFormError(
        fetchLike
          ? `Não foi possível contactar a API (${endpoint}). Verifique CORS no servidor da API, se o URL está certo e a ligação.${sslHint} Detalhe: ${detail}`
          : `Erro ao ligar ao servidor (${endpoint}): ${detail}`,
      )
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
    setFormError('')
    if (!validateEmail(email)) {
      setFormError('Informe o e-mail cadastrado para usar a biometria.')
      return
    }
    if (!webAuthnSupported()) {
      setFormError('Biometria requer HTTPS (ou localhost) e um navegador compatível no celular.')
      return
    }
    setBioLoading(true)
    try {
      const data = await loginWithWebAuthn(email)
      let u = data.user || {}
      u = await aplicarConviteFamiliaAposLogin(u)
      if (u?.id) {
        window.localStorage.setItem('horizonte_user', JSON.stringify(u))
      }
      navigateAfterLogin(u)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível entrar com biometria.')
      setBioLoading(false)
    }
  }

  return (
    <AuthPhoneShell
      visuallyHiddenTitle="Login"
      showBodyLogo
      bodyLogoSrc={BRAND_ASSETS.loginSeverinoLight}
      bodyLogoIntrinsicSize={BRAND_LOGO_PIXEL_SIZE.severinoTemaClaro}
      bodyLogoAlt="Severino"
      heroImageSrc="/images/Login/01.avif"
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
      {severinoProdApiMisconfigured() ? (
        <div
          className="mb-4 rounded-lg border border-amber-400/80 bg-amber-50 px-3 py-2.5 text-[11px] leading-snug text-amber-950 sm:text-[12px]"
          role="alert"
        >
          <strong className="font-semibold">API não configurada no build.</strong> O deploy Git na
          Hostinger só publica o front. Escolhe uma: (1){' '}
          <strong>VPS Hostinger</strong> com Node a correr a API e Nginx/OpenLiteSpeed a enviar{' '}
          <span className="font-mono">/api</span> para esse processo — nas variáveis do build define{' '}
          <code className="rounded bg-amber-100/90 px-1 font-mono text-[10px] sm:text-[11px]">
            VITE_SEVERINO_SAME_ORIGIN_API=1
          </code>{' '}
          e novo deploy;           (2) API na Vercel ou outro host — no build da Hostinger define{' '}
          <code className="rounded bg-amber-100/90 px-1 font-mono text-[10px] sm:text-[11px]">
            VITE_SEVERINO_API_ORIGIN
          </code>{' '}
          com o URL base (ex. <span className="font-mono">https://teu-app.vercel.app</span>, sem{' '}
          <span className="font-mono">/api</span>) onde <span className="font-mono">/api/health</span> devolve JSON.
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6" noValidate>
        <label className="block" htmlFor="email">
          <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">E-mail</span>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoComplete="email"
            className={AUTH_SHELL_INPUT_CLASS}
          />
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
              className={`${AUTH_SHELL_INPUT_CLASS} pr-11 placeholder:text-neutral-300 sm:pr-12`}
            />
            <AuthPasswordToggleButton passwordVisible={showSenha} onToggle={() => setShowSenha((v) => !v)} />
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

      {formError ? (
        <div className="mt-4 rounded-[12px] border border-error/35 bg-error/10 p-3 text-center text-[11px] text-red-700 sm:text-[12px]">
          {formError}
        </div>
      ) : null}
    </AuthPhoneShell>
  )
}
