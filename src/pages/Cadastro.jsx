import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthPasswordToggleButton from '../components/AuthPasswordToggleButton'
import AuthPhoneShell from '../components/AuthPhoneShell'
import FamiliaConviteColarBlock from '../components/FamiliaConviteColarBlock'
import { AUTH_SHELL_INPUT_CLASS } from '../lib/authFormClasses'
import { apiUrl } from '../lib/apiUrl'
import { writeHorizonteAccessToken, writeHorizonteRefreshToken } from '../lib/horizonteAccessToken'
import { showToast } from '../lib/toastStore'
import { validateEmail } from '../lib/validateEmail'
import { maskPhoneBRMobile, validatePhoneBRMobile } from '../lib/formatPhoneBR'

// 1 = fraca, 2 = média, 3 = forte
function senhaForca(s) {
  if (!s || s.length < 6) return 0
  if (s.length >= 10 && /\d/.test(s) && /[^a-zA-Z0-9]|[A-Z]/.test(s)) return 3
  if (s.length >= 8 && /[\d\W_]/.test(s)) return 2
  return 1
}

const FORCA_LABEL = ['Muito curta', 'Fraca', 'Média', 'Forte']
const FORCA_COR = ['', 'bg-red-400', 'bg-amber-400', 'bg-[var(--accent)]']

export default function Cadastro() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const conviteQuery = useMemo(() => searchParams.get('convite')?.trim() || '', [searchParams])

  const loginHref = conviteQuery ? `/login?convite=${encodeURIComponent(conviteQuery)}` : '/login'
  const [step, setStep] = useState(1)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [errors, setErrors] = useState({})
  const [pendingUserId, setPendingUserId] = useState(null)
  const [telefoneMascarado, setTelefoneMascarado] = useState('')
  const [emailMascarado, setEmailMascarado] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [emailOtp, setEmailOtp] = useState('')
  const [emailOtpError, setEmailOtpError] = useState('')
  const [emailOtpLoading, setEmailOtpLoading] = useState(false)
  const [emailResendCooldown, setEmailResendCooldown] = useState(0)
  const [totalSteps, setTotalSteps] = useState(null)

  const forca = senhaForca(senha)

  const validateStep1 = () => {
    const newErrors = {}
    if (!nome.trim() || nome.trim().length < 3) newErrors.nome = 'Informe seu nome completo (mínimo 3 caracteres)'
    const phoneResult = validatePhoneBRMobile(telefone)
    if (!phoneResult.ok) newErrors.telefone = phoneResult.message
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors = {}
    if (!validateEmail(email.trim())) newErrors.email = 'E-mail inválido'
    if (senha.length < 6) newErrors.senha = 'Mínimo 6 caracteres'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setErrors({})
      setStep(2)
    }
  }

  const handleBack = () => {
    setErrors({})
    setStep(1)
  }

  const navigateAfterLogin = (u) => {
    const navOpts = { replace: true, state: { freshLogin: true } }
    if (u.mostrar_bem_vindo_assinatura) {
      navigate('/bem-vindo-assinatura', navOpts)
    } else if (u.acesso_app_liberado === false) {
      navigate('/trial-expirado', navOpts)
    } else {
      navigate('/dashboard', navOpts)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return

    setLoading(true)
    try {
      const response = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          telefone,
          email: email.trim().toLowerCase(),
          senha,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const msg = data.message || 'Erro ao criar conta.'
        if (response.status === 409) {
          if (data.field === 'telefone') {
            setErrors({ telefone: msg })
            setStep(1)
          } else {
            // email ou genérico
            setErrors({ email: msg })
          }
        } else {
          showToast(msg, 'error')
        }
        setLoading(false)
        return
      }

      if (data.needsPhoneVerification || data.needsEmailVerification) {
        const total = 2 + (data.needsPhoneVerification ? 1 : 0) + (data.needsEmailVerification ? 1 : 0)
        setTotalSteps(total)
        setPendingUserId(data.userId)
        if (data.needsPhoneVerification) {
          setTelefoneMascarado(data.telefoneMascarado || '')
          setEmailMascarado(data.emailMascarado || '')
          setResendCooldown(60)
          setStep(3)
        } else {
          setEmailMascarado(data.emailMascarado || '')
          setEmailResendCooldown(60)
          setStep(4)
        }
        setLoading(false)
        return
      }

      if (data.accessToken) writeHorizonteAccessToken(data.accessToken)
      if (data.refreshToken) writeHorizonteRefreshToken(data.refreshToken)
      window.localStorage.setItem('horizonte_user', JSON.stringify(data.user))
      navigateAfterLogin(data.user)
    } catch {
      showToast('Erro ao conectar com o servidor', 'error')
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const digits = otp.replace(/\D/g, '')
    if (digits.length !== 6) {
      setOtpError('Digite os 6 dígitos do código.')
      return
    }
    setOtpError('')
    setOtpLoading(true)
    try {
      const response = await fetch(apiUrl('/api/auth/verify-registration'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId, otp: digits }),
      })
      const data = await response.json()
      if (!response.ok) {
        setOtpError(data.message || 'Código inválido.')
        setOtpLoading(false)
        return
      }
      if (data.needsEmailVerification) {
        setEmailResendCooldown(60)
        setStep(4)
        setOtpLoading(false)
        return
      }
      if (data.accessToken) writeHorizonteAccessToken(data.accessToken)
      if (data.refreshToken) writeHorizonteRefreshToken(data.refreshToken)
      window.localStorage.setItem('horizonte_user', JSON.stringify(data.user))
      navigateAfterLogin(data.user)
    } catch {
      setOtpError('Erro ao conectar com o servidor.')
      setOtpLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    try {
      const response = await fetch(apiUrl('/api/auth/resend-registration-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId }),
      })
      const data = await response.json()
      if (response.ok) {
        showToast(data.message || 'Novo código enviado.', 'success')
        setResendCooldown(60)
      } else {
        showToast(data.message || 'Não foi possível reenviar.', 'error')
      }
    } catch {
      showToast('Erro ao conectar com o servidor.', 'error')
    }
  }

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault()
    const digits = emailOtp.replace(/\D/g, '')
    if (digits.length !== 6) {
      setEmailOtpError('Digite os 6 dígitos do código.')
      return
    }
    setEmailOtpError('')
    setEmailOtpLoading(true)
    try {
      const response = await fetch(apiUrl('/api/auth/verify-email-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId, otp: digits }),
      })
      const data = await response.json()
      if (!response.ok) {
        setEmailOtpError(data.message || 'Código inválido.')
        setEmailOtpLoading(false)
        return
      }
      if (data.accessToken) writeHorizonteAccessToken(data.accessToken)
      if (data.refreshToken) writeHorizonteRefreshToken(data.refreshToken)
      window.localStorage.setItem('horizonte_user', JSON.stringify(data.user))
      navigateAfterLogin(data.user)
    } catch {
      setEmailOtpError('Erro ao conectar com o servidor.')
      setEmailOtpLoading(false)
    }
  }

  const handleResendEmailOtp = async () => {
    if (emailResendCooldown > 0) return
    try {
      const response = await fetch(apiUrl('/api/auth/resend-email-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId }),
      })
      const data = await response.json()
      if (response.ok) {
        showToast(data.message || 'Novo código enviado.', 'success')
        setEmailResendCooldown(60)
      } else {
        showToast(data.message || 'Não foi possível reenviar.', 'error')
      }
    } catch {
      showToast('Erro ao conectar com o servidor.', 'error')
    }
  }

  useEffect(() => {
    if (emailResendCooldown <= 0) return
    const t = setTimeout(() => setEmailResendCooldown((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [emailResendCooldown])

  return (
    <AuthPhoneShell
      title="Criar conta"
      subtitle="Seu dinheiro organizado em 2 minutos."
      compact={step === 1}
      footer={
        <>
          Já tem conta?{' '}
          <Link
            to={loginHref}
            className="cursor-pointer font-semibold text-[var(--accent)] underline-offset-4 transition hover:text-[var(--accent-hover)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Fazer login
          </Link>
        </>
      }
    >
      {conviteQuery && step <= 2 && (
        <div className="mb-4 sm:mb-5">
          <FamiliaConviteColarBlock idPrefix="cadastro-familia-convite" />
        </div>
      )}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Passo {step} de {totalSteps ?? (step > 2 ? step : 2)}
          </span>
          <span className="text-[10px] text-neutral-400">
            {step === 1 ? 'Dados pessoais' : step === 2 ? 'Segurança' : step === 3 ? 'WhatsApp' : 'E-mail'}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-neutral-200/90">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${(step / (totalSteps ?? (step > 2 ? step : 2))) * 100}%` }}
          />
        </div>
      </div>

      {step === 3 && (
        <form onSubmit={handleVerifyOtp} className="space-y-5 sm:space-y-6">
          <div className="space-y-5 sm:space-y-6">
            <div className="rounded-[14px] bg-neutral-50 px-4 py-3 text-[12px] text-neutral-600">
              Enviamos um código de 6 dígitos para o WhatsApp{telefoneMascarado ? ` ${telefoneMascarado}` : ''}.
              Insira abaixo para confirmar seu número.
            </div>

            <label className="block" htmlFor="otp">
              <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">Código de confirmação</span>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  if (otpError) setOtpError('')
                }}
                placeholder="000000"
                autoFocus
                autoComplete="one-time-code"
                className={AUTH_SHELL_INPUT_CLASS + ' tracking-[0.3em] text-center text-[20px]'}
              />
              {otpError && (
                <p role="alert" className="mt-1 text-[10px] text-red-600">{otpError}</p>
              )}
            </label>

            <button
              type="submit"
              disabled={otpLoading}
              className="min-h-[46px] w-full cursor-pointer rounded-[14px] bg-[var(--accent)] px-4 py-3 text-[13px] font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-accent)] transition hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[48px] sm:text-[14px]"
            >
              {otpLoading ? 'Verificando...' : 'Confirmar número'}
            </button>

            <p className="text-center text-[11px] text-neutral-500">
              Não recebeu?{' '}
              {resendCooldown > 0 ? (
                <span className="text-neutral-400">Reenviar em {resendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="cursor-pointer font-semibold text-[var(--accent)] underline-offset-4 transition hover:text-[var(--accent-hover)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
                >
                  Reenviar código
                </button>
              )}
            </p>
          </div>
        </form>
      )}

      {step === 4 && (
        <form onSubmit={handleVerifyEmailOtp} className="space-y-5 sm:space-y-6">
          <div className="space-y-5 sm:space-y-6">
            <div className="rounded-[14px] bg-neutral-50 px-4 py-3 text-[12px] text-neutral-600">
              Enviamos um código de 6 dígitos para{emailMascarado ? ` ${emailMascarado}` : ' o seu e-mail'}.
              Verifique sua caixa de entrada e spam.
            </div>

            <label className="block" htmlFor="email-otp">
              <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">Código do e-mail</span>
              <input
                id="email-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={emailOtp}
                onChange={(e) => {
                  setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  if (emailOtpError) setEmailOtpError('')
                }}
                placeholder="000000"
                autoFocus
                autoComplete="one-time-code"
                className={AUTH_SHELL_INPUT_CLASS + ' tracking-[0.3em] text-center text-[20px]'}
              />
              {emailOtpError && (
                <p role="alert" className="mt-1 text-[10px] text-red-600">{emailOtpError}</p>
              )}
            </label>

            <button
              type="submit"
              disabled={emailOtpLoading}
              className="min-h-[46px] w-full cursor-pointer rounded-[14px] bg-[var(--accent)] px-4 py-3 text-[13px] font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-accent)] transition hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[48px] sm:text-[14px]"
            >
              {emailOtpLoading ? 'Verificando...' : 'Confirmar e-mail'}
            </button>

            <p className="text-center text-[11px] text-neutral-500">
              Não recebeu?{' '}
              {emailResendCooldown > 0 ? (
                <span className="text-neutral-400">Reenviar em {emailResendCooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendEmailOtp}
                  className="cursor-pointer font-semibold text-[var(--accent)] underline-offset-4 transition hover:text-[var(--accent-hover)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
                >
                  Reenviar código
                </button>
              )}
            </p>
          </div>
        </form>
      )}

      <form onSubmit={handleSubmit} className={step === 3 || step === 4 ? 'hidden' : 'space-y-5 sm:space-y-6'}>
        {step === 1 && (
          <div className="space-y-5 sm:space-y-6">
            <label className="block" htmlFor="nome">
              <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">Nome completo</span>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
                autoComplete="name"
                className={AUTH_SHELL_INPUT_CLASS}
              />
              {errors.nome && <p role="alert" className="mt-1 text-[10px] text-red-600">{errors.nome}</p>}
            </label>

            <label className="block" htmlFor="telefone">
              <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">Telefone</span>
              <input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(maskPhoneBRMobile(e.target.value))}
                placeholder="(00) 00000-0000"
                required
                maxLength={15}
                autoComplete="tel"
                className={AUTH_SHELL_INPUT_CLASS}
              />
              <p className="mt-1 text-[10px] text-neutral-400">Usado para recuperar sua senha via WhatsApp</p>
              {errors.telefone && <p role="alert" className="mt-1 text-[10px] text-red-600">{errors.telefone}</p>}
            </label>

            <button
              type="button"
              onClick={handleNext}
              className="min-h-[46px] w-full cursor-pointer rounded-[14px] bg-[var(--accent)] px-4 py-3 text-[13px] font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-accent)] transition hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:min-h-[48px] sm:text-[14px]"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 sm:space-y-6">
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
              {errors.email && <p role="alert" className="mt-1 text-[10px] text-red-600">{errors.email}</p>}
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
                  autoComplete="new-password"
                  className={`${AUTH_SHELL_INPUT_CLASS} pr-11 placeholder:text-neutral-300 sm:pr-12`}
                />
                <AuthPasswordToggleButton passwordVisible={showSenha} onToggle={() => setShowSenha((v) => !v)} />
              </div>
              {senha.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${forca > 0 && forca >= n ? FORCA_COR[forca] : 'bg-neutral-200'}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-400">{FORCA_LABEL[forca]}</p>
                </div>
              )}
              {errors.senha && <p role="alert" className="mt-1 text-[10px] text-red-600">{errors.senha}</p>}
            </label>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleBack}
                className="min-h-[46px] flex-1 cursor-pointer rounded-[14px] border border-neutral-200/95 bg-white/90 px-4 py-3 text-[12px] font-medium text-neutral-900 backdrop-blur-sm transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] sm:min-h-[48px] sm:text-[13px]"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[46px] flex-[1.5] cursor-pointer rounded-[14px] bg-[var(--accent)] px-4 py-3 text-[12px] font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-accent)] transition hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[48px] sm:text-[13px] overflow-hidden whitespace-nowrap"
              >
                {loading ? 'Criando...' : 'Criar conta'}
              </button>
            </div>
          </div>
        )}
      </form>
    </AuthPhoneShell>
  )
}
