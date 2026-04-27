import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSupabaseErrorMessage, parseSupabaseResponse, supabaseKey, supabaseUrl } from '../lib/supabase'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { showToast } from '../components/Toast'

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
  
  const senhaLengthOk = senha.length >= 6
  const senhasCoincidem = senha && senha === confirmarSenha

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
    <div className="fixed inset-0 z-[1] flex items-center justify-center overflow-hidden p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-[400px]">
        <div className="bg-black/65 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-center mb-6">
              <img 
                src={BRAND_ASSETS.logoOnDark}
                alt="Horizonte Financeiro" 
                className="mx-auto block h-auto w-[220px] drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)]"
              />
            </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-[#d4a84b] font-bold">
                Passo {step} de 2
              </span>
              <span className="text-[10px] text-[#737373]">
                {step === 1 ? 'Dados Pessoais' : 'Segurança da Conta'}
              </span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#d4a84b] transition-all duration-500 ease-out"
                style={{ width: `${(step / 2) * 100}%` }}
              />
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-center text-[#f5f5f5] mb-2">
            {step === 1 ? 'Olá! Vamos começar?' : 'Quase lá...'}
          </h1>
          <p className="text-center text-[#a3a3a3] mb-8 text-sm">
            {step === 1 
              ? 'Conte-nos um pouco sobre você' 
              : 'Defina como você acessará o Horizonte'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <div>
                  <label className="block text-[#a3a3a3] text-xs font-medium mb-1.5" htmlFor="nome">
                    Nome completo
                  </label>
                  <input
                    id="nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200"
                  />
                  {errors.nome && <p className="text-red-400 text-[10px] mt-1">{errors.nome}</p>}
                </div>

                <div>
                  <label className="block text-[#a3a3a3] text-xs font-medium mb-1.5" htmlFor="telefone">
                    Telefone
                  </label>
                  <input
                    id="telefone"
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    required
                    maxLength={15}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200"
                  />
                  {errors.telefone && <p className="text-red-400 text-[10px] mt-1">{errors.telefone}</p>}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full py-3.5 bg-[#d4a84b] text-[#0a0a0a] rounded-xl font-bold text-sm hover:bg-[#b8923f] hover:-translate-y-0.5 shadow-lg active:scale-95 transition-all duration-200 mt-4"
                >
                  Continuar
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <div>
                  <label className="block text-[#a3a3a3] text-xs font-medium mb-1.5" htmlFor="email">
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200"
                  />
                  {errors.email && <p className="text-red-400 text-[10px] mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-[#a3a3a3] text-xs font-medium mb-1.5" htmlFor="senha">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="senha"
                      type={showSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#a3a3a3] transition-colors"
                    >
                      {showSenha ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88l-3.29-3.29m7.53 7.53l3.29 3.29M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <div className={`h-1 flex-1 rounded-full transition-colors ${senhaLengthOk ? 'bg-green-500' : 'bg-white/10'}`} />
                    <div className={`h-1 flex-1 rounded-full transition-colors ${senhaLengthOk && senhasCoincidem ? 'bg-green-500' : 'bg-white/10'}`} />
                    <div className={`h-1 flex-1 rounded-full transition-colors ${senhaLengthOk && senhasCoincidem && senha.length > 8 ? 'bg-green-500' : 'bg-white/10'}`} />
                  </div>
                </div>

                <div>
                  <label className="block text-[#a3a3a3] text-xs font-medium mb-1.5" htmlFor="confirmarSenha">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <input
                      id="confirmarSenha"
                      type={showConfirmarSenha ? 'text' : 'password'}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Repita sua senha"
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#a3a3a3] transition-colors"
                    >
                      {showConfirmarSenha ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88l-3.29-3.29m7.53 7.53l3.29 3.29M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                  {errors.confirmarSenha && <p className="text-red-400 text-[10px] mt-1">{errors.confirmarSenha}</p>}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 py-3.5 bg-white/5 text-[#f5f5f5] border border-white/10 rounded-xl font-bold text-sm hover:bg-white/10 transition-all duration-200"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-3.5 bg-[#d4a84b] text-[#0a0a0a] rounded-xl font-bold text-sm hover:bg-[#b8923f] hover:-translate-y-0.5 shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? 'Criando...' : 'Finalizar'}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="text-center text-[#a3a3a3] mt-8 text-xs">
            Já tem conta?{' '}
            <Link to="/login" className="text-[#d4a84b] font-semibold hover:text-[#b8923f] hover:underline transition-colors">
              Fazer login
            </Link>
          </p>

          <div className="flex items-center justify-center gap-2 mt-6 text-[#737373] text-[10px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span>Conexão segura SSL</span>
          </div>
        </div>
      </div>
    </div>
  )
}
