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
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordState, setForgotPasswordState] = useState({ text: '', type: '', link: '' })
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' })
  const [loading, setLoading] = useState(false)
  const [requestingReset, setRequestingReset] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [hasWebAuthn, setHasWebAuthn] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY)

    if (savedEmail) {
      setEmail(savedEmail)
      setForgotEmail(savedEmail)
      setRememberEmail(true)
    }
  }, [])

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
    setForgotEmail(email)
  }, [email])

  async function handleForgotPassword(event) {
    event.preventDefault()
    setForgotPasswordState({ text: '', type: '', link: '' })

    const normalizedEmail = forgotEmail.trim().toLowerCase()

    if (!validateEmail(normalizedEmail)) {
      setForgotPasswordState({ text: 'Informe um e-mail válido para recuperar a senha.', type: 'error', link: '' })
      return
    }

    setRequestingReset(true)
    const controller = new AbortController()
    const resetRequestTimeoutId = window.setTimeout(() => controller.abort(), 45000)

    try {
      const response = await fetch(apiUrl('/api/auth/request-password-reset'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
        signal: controller.signal,
      })
      const data = await response.json()

      if (!response.ok) {
        setForgotPasswordState({ text: data.message || 'Nao foi possivel enviar o link de redefinicao.', type: 'error', link: '' })
        return
      }

      setForgotPasswordState({
        text: data.message || 'Enviamos um link para seu e-mail.',
        type: 'success',
        link: data.devResetUrl || '',
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        setForgotPasswordState({ text: 'O envio demorou mais do que o esperado. Se o problema continuar, tente novamente em alguns instantes.', type: 'error', link: '' })
        return
      }

      setForgotPasswordState({ text: 'Erro ao conectar com o servidor.', type: 'error', link: '' })
    } finally {
      window.clearTimeout(resetRequestTimeoutId)
      setRequestingReset(false)
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
      showBodyLogo
      compact={!showForgotPassword && !(webAuthnSupported() && hasWebAuthn)}
      footer={
        <>
          Não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-[#050505] underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <label className="block" htmlFor="email">
          <span className="mb-2 block text-[11px] font-medium text-[#111827]">Email</span>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoComplete="email"
            className="w-full rounded-[10px] border border-transparent bg-white px-3 py-3 text-[12px] text-[#111827] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] outline-none transition placeholder:text-[#a3a3a3] focus:border-[#111827]/15 focus:shadow-[0_18px_34px_-24px_rgba(15,23,42,0.7)] focus-visible:ring-2 focus-visible:ring-[#111827]/20"
          />
        </label>

        <label className="block" htmlFor="senha">
          <span className="mb-2 block text-[11px] font-medium text-[#111827]">Password</span>
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
              className="w-full rounded-[10px] border border-transparent bg-white px-3 py-3 pr-10 text-[12px] text-[#111827] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] outline-none transition placeholder:text-[#cfcfcf] focus:border-[#111827]/15 focus-visible:ring-2 focus-visible:ring-[#111827]/20"
            />
            <button
              type="button"
              onClick={() => setShowSenha(!showSenha)}
              aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-[#9ca3af] transition hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20"
            >
              {showSenha ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[11px] font-medium text-[#4b5563]">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              className="h-3.5 w-3.5 rounded border border-[#d1d5db] accent-[#050505]"
            />
            <span>Lembrar e-mail</span>
          </label>
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault()
              setShowForgotPassword((current) => !current)
              setForgotEmail(email)
              setForgotPasswordState({ text: '', type: '', link: '' })
            }}
            className="text-[11px] font-medium text-[#111827] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20"
          >
            Esqueceu a senha?
          </a>
        </div>

        {showForgotPassword && (
          <div className="rounded-[14px] border border-[#eef0f4] bg-[#fafafa] p-3">
            <p className="mb-2 text-[11px] leading-snug text-[#4b5563]">
              Digite seu e-mail para receber um link seguro de redefinição.
            </p>
            <div className="space-y-2">
              <input
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2.5 text-[12px] text-[#111827] outline-none placeholder:text-[#a3a3a3] focus-visible:ring-2 focus-visible:ring-[#111827]/20"
                autoComplete="email"
                required
              />
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={requestingReset}
                className="w-full rounded-[10px] border border-[#111827]/10 bg-white px-3 py-2 text-[11px] font-semibold text-[#111827] transition hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestingReset ? 'Enviando link...' : 'Enviar link de redefinição'}
              </button>
            </div>

            {forgotPasswordState.text && (
              <div
                className={`mt-2 rounded-[10px] border p-2 text-[11px] ${
                  forgotPasswordState.type === 'success'
                    ? 'border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.1)] text-[#15803d]'
                    : 'border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] text-[#dc2626]'
                }`}
              >
                <p>{forgotPasswordState.text}</p>
                {forgotPasswordState.link && (
                  <a href={forgotPasswordState.link} className="mt-1 inline-block font-medium underline">
                    Abrir link de redefinição
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || bioLoading}
          className="min-h-[42px] w-full rounded-[8px] bg-[#050505] px-4 py-3 text-[12px] font-medium text-white shadow-[0_18px_28px_-22px_rgba(0,0,0,0.9)] transition hover:bg-[#111111] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/35 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Login'}
        </button>

        {webAuthnSupported() && hasWebAuthn && (
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={loading || bioLoading}
            className="min-h-[42px] w-full rounded-[8px] border border-[#e5e7eb] bg-white px-4 py-3 text-[12px] font-medium text-[#111827] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bioLoading ? 'Abrindo biometria...' : 'Entrar com biometria'}
          </button>
        )}
      </form>

      {mensagem.texto && (
        <div
          className={`mt-4 rounded-[10px] border p-2 text-center text-[11px] ${
            mensagem.tipo === 'sucesso'
              ? 'border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.1)] text-[#15803d]'
              : 'border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] text-[#dc2626]'
          }`}
        >
          {mensagem.texto}
        </div>
      )}
    </AuthPhoneShell>
  )
}
