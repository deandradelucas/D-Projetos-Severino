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

  return (
    <AuthPhoneShell
      title="Sign Up"
      headerTitle="Sign Up"
      showBack
      compact={step === 1}
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-[#050505] underline-offset-4 hover:underline">
            Fazer login
          </Link>
        </>
      }
    >
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Passo {step} de 2</span>
          <span className="text-[10px] text-[#9ca3af]">{step === 1 ? 'Dados pessoais' : 'Segurança'}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[#eef0f4]">
          <div className="h-full rounded-full bg-[#050505] transition-all duration-500" style={{ width: `${(step / 2) * 100}%` }} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {step === 1 && (
          <div className="space-y-5">
            <label className="block" htmlFor="nome">
              <span className="mb-2 block text-[11px] font-medium text-[#111827]">Nome completo</span>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
                className="w-full rounded-[10px] border border-transparent bg-white px-3 py-3 text-[12px] text-[#111827] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] outline-none transition placeholder:text-[#a3a3a3] focus:border-[#111827]/15 focus-visible:ring-2 focus-visible:ring-[#111827]/20"
              />
              {errors.nome && <p className="mt-1 text-[10px] text-red-500">{errors.nome}</p>}
            </label>

            <label className="block" htmlFor="telefone">
              <span className="mb-2 block text-[11px] font-medium text-[#111827]">Telefone</span>
              <input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
                required
                maxLength={15}
                className="w-full rounded-[10px] border border-transparent bg-white px-3 py-3 text-[12px] text-[#111827] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] outline-none transition placeholder:text-[#a3a3a3] focus:border-[#111827]/15 focus-visible:ring-2 focus-visible:ring-[#111827]/20"
              />
              {errors.telefone && <p className="mt-1 text-[10px] text-red-500">{errors.telefone}</p>}
            </label>

            <button
              type="button"
              onClick={handleNext}
              className="min-h-[42px] w-full rounded-[8px] bg-[#050505] px-4 py-3 text-[12px] font-medium text-white shadow-[0_18px_28px_-22px_rgba(0,0,0,0.9)] transition hover:bg-[#111111] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/35"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <label className="block" htmlFor="email">
              <span className="mb-2 block text-[11px] font-medium text-[#111827]">Email</span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full rounded-[10px] border border-transparent bg-white px-3 py-3 text-[12px] text-[#111827] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] outline-none transition placeholder:text-[#a3a3a3] focus:border-[#111827]/15 focus-visible:ring-2 focus-visible:ring-[#111827]/20"
              />
              {errors.email && <p className="mt-1 text-[10px] text-red-500">{errors.email}</p>}
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
                  className="w-full rounded-[10px] border border-transparent bg-white px-3 py-3 pr-10 text-[12px] text-[#111827] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] outline-none transition placeholder:text-[#cfcfcf] focus:border-[#111827]/15 focus-visible:ring-2 focus-visible:ring-[#111827]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-[11px] text-[#9ca3af] transition hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20"
                >
                  {showSenha ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </label>

            <label className="block" htmlFor="confirmarSenha">
              <span className="mb-2 block text-[11px] font-medium text-[#111827]">Confirm password</span>
              <div className="relative">
                <input
                  id="confirmarSenha"
                  type={showConfirmarSenha ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-[10px] border border-transparent bg-white px-3 py-3 pr-10 text-[12px] text-[#111827] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] outline-none transition placeholder:text-[#cfcfcf] focus:border-[#111827]/15 focus-visible:ring-2 focus-visible:ring-[#111827]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-[11px] text-[#9ca3af] transition hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20"
                >
                  {showConfirmarSenha ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              {errors.confirmarSenha && <p className="mt-1 text-[10px] text-red-500">{errors.confirmarSenha}</p>}
            </label>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleBack}
                className="min-h-[42px] flex-1 rounded-[8px] border border-[#e5e7eb] bg-white px-4 py-3 text-[12px] font-medium text-[#111827] transition hover:bg-[#f9fafb]"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[42px] flex-[1.5] rounded-[8px] bg-[#050505] px-4 py-3 text-[12px] font-medium text-white shadow-[0_18px_28px_-22px_rgba(0,0,0,0.9)] transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Criando...' : 'Sign Up'}
              </button>
            </div>
          </div>
        )}
      </form>
    </AuthPhoneShell>
  )
}
