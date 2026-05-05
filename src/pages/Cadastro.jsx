import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSupabaseErrorMessage, parseSupabaseResponse, supabaseKey, supabaseUrl } from '../lib/supabase'
import AuthPhoneShell from '../components/AuthPhoneShell'
import { showToast } from '../lib/toastStore'

function formatTelefone(value) {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 2) return `(${numbers}`
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}



export default function Cadastro() {
  const navigate = useNavigate()
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

      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch {
      showToast('Erro ao conectar com o servidor', 'error')
      setLoading(false)
    }
  }

  const inputGlass =
    'w-full rounded-[14px] border border-neutral-200/95 bg-white/75 px-3 py-3 text-[12px] text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none backdrop-blur-sm transition placeholder:text-neutral-400 focus:border-orange-400/70 focus:bg-white focus-visible:ring-2 focus-visible:ring-orange-400/35 sm:min-h-[46px] sm:px-4 sm:text-[13px]'

  return (
    <AuthPhoneShell
      title="Criar conta"
      headerTitle="Criar conta"
      subtitle="Preencha seus dados para começar."
      compact={step === 1}
      footer={
        <>
          Já tem conta?{' '}
          <Link
            to="/login"
            className="cursor-pointer font-semibold text-orange-600 underline-offset-4 transition hover:text-orange-500 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Fazer login
          </Link>
        </>
      }
    >
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Passo {step} de 2</span>
          <span className="text-[10px] text-neutral-400">{step === 1 ? 'Dados pessoais' : 'Segurança'}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-neutral-200/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-fuchsia-600 transition-all duration-500"
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
                className={inputGlass}
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
                className={inputGlass}
              />
              {errors.telefone && <p className="mt-1 text-[10px] text-red-600">{errors.telefone}</p>}
            </label>

            <button
              type="button"
              onClick={handleNext}
              className="min-h-[46px] w-full cursor-pointer rounded-[14px] bg-gradient-to-r from-orange-500 via-orange-500 to-fuchsia-600 px-4 py-3 text-[13px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(249,115,22,0.45)] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:min-h-[48px] sm:text-[14px]"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 sm:space-y-6">
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
                  className={`${inputGlass} pr-11 sm:pr-12`}
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
                  className={`${inputGlass} pr-11 sm:pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/45 sm:right-3"
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
                  className={`${inputGlass} pr-11 sm:pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                  aria-label={showConfirmarSenha ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/45 sm:right-3"
                >
                  {showConfirmarSenha ? (
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
              {errors.confirmarSenha && <p className="mt-1 text-[10px] text-red-600">{errors.confirmarSenha}</p>}
            </label>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleBack}
                className="min-h-[46px] flex-1 cursor-pointer rounded-[14px] border border-neutral-200/95 bg-white/90 px-4 py-3 text-[12px] font-medium text-neutral-900 backdrop-blur-sm transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/35 sm:min-h-[48px] sm:text-[13px]"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[46px] flex-[1.5] cursor-pointer rounded-[14px] bg-gradient-to-r from-orange-500 via-orange-500 to-fuchsia-600 px-4 py-3 text-[12px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(249,115,22,0.45)] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-[48px] sm:text-[13px]"
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
