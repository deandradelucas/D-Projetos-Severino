import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getSupabaseErrorMessage, parseSupabaseResponse, supabaseKey, supabaseUrl } from '../lib/supabase'
import { BRAND_ASSETS } from '../lib/brandAssets'

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
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' })
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false)
  const [errors, setErrors] = useState({})
  const [animate, setAnimate] = useState(false)
  const formRef = useRef(null)
  const inputsRef = useRef([])

  useEffect(() => {
    setAnimate(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        const inputs = inputsRef.current.filter(input => input)
        const firstInput = inputs[0]
        const lastInput = inputs[inputs.length - 1]
        
        if (e.shiftKey && document.activeElement === firstInput) {
          e.preventDefault()
          lastInput?.focus()
        } else if (!e.shiftKey && document.activeElement === lastInput) {
          e.preventDefault()
          firstInput?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const validateField = (field, value) => {
    const newErrors = { ...errors }
    
    if (field === 'email' && value) {
      newErrors.email = validateEmail(value) ? '' : 'E-mail inválido'
    }
    if (field === 'senha' && value && value.length < 6) {
      newErrors.senha = 'Mínimo 6 caracteres'
    }
    if (field === 'confirmarSenha' && value !== senha) {
      newErrors.confirmarSenha = 'As senhas não coincidem'
    } else if (field === 'confirmarSenha') {
      newErrors.confirmarSenha = ''
    }
    
    setErrors(newErrors)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensagem({ texto: '', tipo: '' })

    if (!validateEmail(email)) {
      setMensagem({ texto: 'E-mail inválido', tipo: 'erro' })
      return
    }
    if (senha !== confirmarSenha) {
      setMensagem({ texto: 'As senhas não coincidem', tipo: 'erro' })
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ nome, telefone, email, senha })
      })

      const data = await parseSupabaseResponse(response)

      if (!response.ok) {
        setMensagem({ texto: `Erro ao cadastrar: ${getSupabaseErrorMessage(data)}`, tipo: 'erro' })
        setLoading(false)
        return
      }

      setMensagem({ texto: 'Cadastro realizado com sucesso!', tipo: 'sucesso' })
      e.target.reset()
      setLoading(false)
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    } catch (err) {
      setMensagem({ texto: 'Erro ao conectar com o banco', tipo: 'erro' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] min-h-[100svh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[360px]">
        <div className={`bg-black/50 backdrop-blur-[2px] border border-white/20 rounded-2xl p-5 sm:p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-500 ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex justify-center mb-5 sm:mb-6">
              <img 
                src={BRAND_ASSETS.logoOnDark}
                alt="Horizonte Financeiro" 
                className="mx-auto block h-auto w-[230px] sm:w-[270px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
              />
            </div>

          <h1 className="text-xl font-semibold text-center text-[#f5f5f5] mb-1">
            Criar Conta
          </h1>
          <p className="text-center text-[#a3a3a3] mb-4 text-xs">
            Comece a organizar sua vida financeira
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" ref={formRef}>
            <div>
              <label className="block text-[#a3a3a3] text-xs font-medium mb-1" htmlFor="nome">
                Nome completo
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
                autoComplete="name"
                ref={el => inputsRef.current[0] = el}
                className="w-full px-3 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[#a3a3a3] text-xs font-medium mb-1" htmlFor="telefone">
                Telefone
              </label>
              <input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
                required
                autoComplete="tel"
                maxLength={15}
                ref={el => inputsRef.current[1] = el}
                className="w-full px-3 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[#a3a3a3] text-xs font-medium mb-1" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  validateField('email', e.target.value)
                }}
                onBlur={(e) => validateField('email', e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                ref={el => inputsRef.current[2] = el}
                className={`w-full px-3 py-2.5 sm:py-3 bg-white/5 border rounded-lg text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:bg-white/10 transition-all duration-200 ${
                  errors.email 
                    ? 'border-red-500 focus:border-red-500' 
                    : 'border-white/10 focus:border-[#d4a84b]'
                }`}
              />
              {errors.email && (
                <p className="text-red-400 text-[10px] mt-1">{errors.email}</p>
              )}
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
                  onChange={(e) => {
                    setSenha(e.target.value)
                    validateField('senha', e.target.value)
                  }}
                  onBlur={(e) => validateField('senha', e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  ref={el => inputsRef.current[3] = el}
                  className={`w-full px-3 py-2.5 sm:py-3 bg-white/5 border rounded-lg text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:bg-white/10 transition-all duration-200 pr-10 ${
                    errors.senha 
                      ? 'border-red-500 focus:border-red-500' 
                      : 'border-white/10 focus:border-[#d4a84b]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
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
              {errors.senha && (
                <p className="text-red-400 text-[10px] mt-1">{errors.senha}</p>
              )}
            </div>

            <div>
              <label className="block text-[#a3a3a3] text-xs font-medium mb-1" htmlFor="confirmarSenha">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  id="confirmarSenha"
                  type={showConfirmarSenha ? 'text' : 'password'}
                  value={confirmarSenha}
                  onChange={(e) => {
                    setConfirmarSenha(e.target.value)
                    validateField('confirmarSenha', e.target.value)
                  }}
                  onBlur={(e) => validateField('confirmarSenha', e.target.value)}
                  placeholder="Repita sua senha"
                  required
                  autoComplete="new-password"
                  ref={el => inputsRef.current[4] = el}
                  className={`w-full px-3 py-2.5 sm:py-3 bg-white/5 border rounded-lg text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:bg-white/10 transition-all duration-200 pr-10 ${
                    errors.confirmarSenha 
                      ? 'border-red-500 focus:border-red-500' 
                      : 'border-white/10 focus:border-[#d4a84b]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#a3a3a3] transition-colors"
                >
                  {showConfirmarSenha ? (
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
              {errors.confirmarSenha && (
                <p className="text-red-400 text-[10px] mt-1">{errors.confirmarSenha}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 bg-[#d4a84b] text-[#0a0a0a] rounded-lg font-semibold text-sm hover:bg-[#b8923f] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(212,168,75,0.2)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none mt-2 min-h-[44px]"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          {mensagem.texto && (
            <div className={`mt-3 p-2 rounded-lg text-center text-xs animate-pulse ${
              mensagem.tipo === 'sucesso' 
                ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e] border border-[rgba(34,197,94,0.3)]'
                : 'bg-[rgba(239,68,68,0.15)] text-[#ef4444] border border-[rgba(239,68,68,0.3)]'
            }`}>
              {mensagem.texto}
            </div>
          )}

          <p className="text-center text-[#a3a3a3] mt-4 text-xs">
            Já tem conta?{' '}
            <Link to="/login" className="text-[#d4a84b] font-medium hover:text-[#b8923f] hover:underline transition-colors">
              Entrar
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
