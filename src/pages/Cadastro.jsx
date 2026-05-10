import { useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthPasswordToggleButton from '../components/AuthPasswordToggleButton'
import AuthPhoneShell from '../components/AuthPhoneShell'
import FamiliaConviteColarBlock from '../components/FamiliaConviteColarBlock'
import { AUTH_SHELL_INPUT_CLASS } from '../lib/authFormClasses'
import { getSupabaseErrorMessage, parseSupabaseResponse, supabaseKey, supabaseUrl } from '../lib/supabase'
import { showToast } from '../lib/toastStore'
import { validateEmail } from '../lib/validateEmail'

function formatTelefone(value) {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 2) return `(${numbers}`
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

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
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false)
  const [errors, setErrors] = useState({})

  const validateStep1 = () => {
    const newErrors = {}
    if (!nome.trim()) newErrors.nome = 'Nome é obrigatório'
    if (!telefone.trim()) newErrors.telefone = 'Telefone é obrigatório'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors = {}
    if (!validateEmail(email)) newErrors.email = 'E-mail inválido'
    if (senha.length < 6) newErrors.senha = 'Mínimo 6 caracteres'
    if (senha !== confirmarSenha) newErrors.confirmarSenha = 'As senhas não coincidem'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return

    setLoading(true)
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          nome,
          telefone: telefone.replace(/\D/g, '') || null,
          email: email.trim().toLowerCase(),
          senha,
        })
      })

      const data = await parseSupabaseResponse(response)

      if (!response.ok) {
        const msg = getSupabaseErrorMessage(data)
        showToast(msg, 'error')
        setLoading(false)
        return
      }

      showToast('Conta criada com sucesso!', 'success')
      setLoading(false)
      window.setTimeout(() => {
        navigate(loginHref)
      }, 1500)
    } catch {
      showToast('Erro ao conectar com o servidor', 'error')
      setLoading(false)
    }
  }

  return (
    <AuthPhoneShell
      title="Criar conta"
      subtitle="Preencha seus dados para começar."
      compact={step === 1}
      footer={
        <>
          Já tem conta?{' '}
          <Link
            to={loginHref}
            className="cursor-pointer font-semibold text-emerald-600 underline-offset-4 transition hover:text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Fazer login
          </Link>
        </>
      }
    >
      <div className="mb-4 sm:mb-5">
        <FamiliaConviteColarBlock idPrefix="cadastro-familia-convite" />
      </div>
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Passo {step} de 2</span>
          <span className="text-[10px] text-neutral-400">{step === 1 ? 'Dados pessoais' : 'Segurança'}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-neutral-200/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
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
              {errors.nome && <p className="mt-1 text-[10px] text-red-600">{errors.nome}</p>}
            </label>

            <label className="block" htmlFor="telefone">
              <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">Telefone</span>
              <input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
                required
                maxLength={15}
                autoComplete="tel"
                className={AUTH_SHELL_INPUT_CLASS}
              />
              {errors.telefone && <p className="mt-1 text-[10px] text-red-600">{errors.telefone}</p>}
            </label>

            <button
              type="button"
              onClick={handleNext}
              className="min-h-[46px] w-full cursor-pointer rounded-[14px] bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-4 py-3 text-[13px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(16,185,129,0.42)] transition hover:brightness-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:min-h-[48px] sm:text-[14px]"
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
              {errors.email && <p className="mt-1 text-[10px] text-red-600">{errors.email}</p>}
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
              {errors.senha && <p className="mt-1 text-[10px] text-red-600">{errors.senha}</p>}
            </label>

            <label className="block" htmlFor="confirmarSenha">
              <span className="mb-2 block text-[11px] font-medium text-neutral-700 sm:text-[12px]">Confirmar senha</span>
              <div className="relative">
                <input
                  id="confirmarSenha"
                  type={showConfirmarSenha ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className={`${AUTH_SHELL_INPUT_CLASS} pr-11 placeholder:text-neutral-300 sm:pr-12`}
                />
                <AuthPasswordToggleButton
                  passwordVisible={showConfirmarSenha}
                  onToggle={() => setShowConfirmarSenha((v) => !v)}
                  ariaLabelShow="Mostrar confirmação de senha"
                  ariaLabelHide="Ocultar confirmação de senha"
                />
              </div>
              {errors.confirmarSenha && <p className="mt-1 text-[10px] text-red-600">{errors.confirmarSenha}</p>}
            </label>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleBack}
                className="min-h-[46px] flex-1 cursor-pointer rounded-[14px] border border-neutral-200/95 bg-white/90 px-4 py-3 text-[12px] font-medium text-neutral-900 backdrop-blur-sm transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/35 sm:min-h-[48px] sm:text-[13px]"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[46px] flex-[1.5] cursor-pointer rounded-[14px] bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-4 py-3 text-[12px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(16,185,129,0.42)] transition hover:brightness-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[48px] sm:text-[13px]"
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
