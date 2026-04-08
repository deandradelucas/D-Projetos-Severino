import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { apiUrl } from '../lib/apiUrl'

const REMEMBER_EMAIL_KEY = 'horizonte_financeiro_remember_email'

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function Login() {
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

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY)

    if (savedEmail) {
      setEmail(savedEmail)
      setForgotEmail(savedEmail)
      setRememberEmail(true)
    }
  }, [])

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
    if (!forgotEmail && email) {
      setForgotEmail(email)
    }
  }, [email, forgotEmail])

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
        setMensagem({ texto: data.message || 'Nao foi possivel fazer login agora.', tipo: 'erro' })
        setLoading(false)
        return
      }

      if (data.user) {
        window.localStorage.setItem('horizonte_user', JSON.stringify(data.user))
      }

      /* Redirecionamento imediato evita estado pendurado no PWA / teclado mobile */
      window.location.replace('/dashboard')
    } catch (err) {
      const net =
        err instanceof TypeError && String(err?.message || '').toLowerCase().includes('fetch')
          ? 'Sem conexão com o servidor. Verifique a internet e se a API está acessível neste endereço.'
          : 'Erro ao conectar com o servidor.'
      setMensagem({ texto: net, tipo: 'erro' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] min-h-[100svh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[360px]">
        <div className="bg-black/50 backdrop-blur-[2px] border border-white/20 rounded-2xl p-5 sm:p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
            <div className="flex justify-center mb-5 sm:mb-6">
              <img 
                src={BRAND_ASSETS.logoOnDark}
                alt="Horizonte Financeiro" 
                className="mx-auto block h-auto w-[230px] sm:w-[270px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
              />
            </div>

          <h1 className="text-xl font-semibold text-center text-[#f5f5f5] mb-1">
            Entrar
          </h1>
          <p className="text-center text-[#a3a3a3] mb-4 text-xs">
            Faça login para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label className="block text-[#a3a3a3] text-xs font-medium mb-1" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[#a3a3a3] text-xs font-medium mb-1" htmlFor="senha">
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha"
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#a3a3a3] transition-colors"
                >
                  {showSenha ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.46.46L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[11px] font-medium text-[#cfcfcf]">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border border-white/20 bg-white/5 accent-[#d4a84b]"
                  />
                  <span>Lembrar e-mail</span>
                </label>
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    setShowForgotPassword((current) => !current)
                    setForgotPasswordState({ text: '', type: '', link: '' })
                  }}
                  className="text-[11px] font-medium text-[#d4a84b] transition-colors hover:text-[#b8923f] hover:underline"
                >
                  Esqueceu a senha?
                </a>
              </div>
            </div>

            {showForgotPassword && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-[11px] text-[#cfcfcf]">
                  Digite seu e-mail para receber um link seguro de redefinição.
                </p>

                <div className="space-y-2">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#737373] transition-all duration-200 focus:border-[#d4a84b] focus:bg-white/10 focus:outline-none"
                    autoComplete="email"
                    required
                  />

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={requestingReset}
                    className="w-full rounded-lg border border-[#d4a84b]/40 bg-transparent px-3 py-2 text-xs font-semibold text-[#d4a84b] transition-colors hover:bg-[#d4a84b]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {requestingReset ? 'Enviando link...' : 'Enviar link de redefinicao'}
                  </button>
                </div>

                {forgotPasswordState.text && (
                  <div
                    className={`mt-2 rounded-lg border p-2 text-[11px] ${
                      forgotPasswordState.type === 'success'
                        ? 'border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.15)] text-[#22c55e]'
                        : 'border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.15)] text-[#ef4444]'
                    }`}
                  >
                    <p>{forgotPasswordState.text}</p>
                    {forgotPasswordState.link && (
                      <a
                        href={forgotPasswordState.link}
                        className="mt-1 inline-block font-medium underline"
                      >
                        Abrir link de redefinicao
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 bg-[#d4a84b] text-[#0a0a0a] rounded-lg font-semibold text-sm hover:bg-[#b8923f] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(212,168,75,0.2)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none mt-2 min-h-[44px]"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {mensagem.texto && (
            <div className={`mt-3 p-2 rounded-lg text-center text-xs ${
              mensagem.tipo === 'sucesso' 
                ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e] border border-[rgba(34,197,94,0.3)]'
                : 'bg-[rgba(239,68,68,0.15)] text-[#ef4444] border border-[rgba(239,68,68,0.3)]'
            }`}>
              {mensagem.texto}
            </div>
          )}

          <p className="text-center text-[#a3a3a3] mt-4 text-xs">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-[#d4a84b] font-medium hover:text-[#b8923f] hover:underline transition-colors">
              Criar conta
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-3 text-[#737373] text-[10px]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
            </svg>
            <span>Seus dados estão seguros</span>
          </div>
        </div>
      </div>
    </div>
  )
}
