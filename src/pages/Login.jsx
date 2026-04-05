import { useState, useEffect, useRef } from 'react'
import { getSupabaseErrorMessage, parseSupabaseResponse, supabaseKey, supabaseUrl } from '../lib/supabase'

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' })
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [animate, setAnimate] = useState(false)
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

    setLoading(true)

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&senha=eq.${encodeURIComponent(senha)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      })

      const data = await parseSupabaseResponse(response)

      if (!response.ok) {
        setMensagem({ texto: `Erro ao fazer login: ${getSupabaseErrorMessage(data)}`, tipo: 'erro' })
        setLoading(false)
        return
      }

      if (data.length === 0) {
        setMensagem({ texto: 'E-mail ou senha incorretos', tipo: 'erro' })
        setLoading(false)
        return
      }

      setMensagem({ texto: 'Login realizado com sucesso!', tipo: 'sucesso' })
      setLoading(false)
      setTimeout(() => {
        window.location.href = '/dashboard'
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
          <div className="flex justify-center mb-4">
            <img 
              src="/images/horizonte_fiel_original_logo_dark.png" 
              alt="Horizonte Financeiro" 
              className="w-44 sm:w-56"
            />
          </div>

          <h1 className="text-xl font-semibold text-center text-[#f5f5f5] mb-1">
            Entrar
          </h1>
          <p className="text-center text-[#a3a3a3] mb-4 text-xs">
            Faça login para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
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
                ref={el => inputsRef.current[0] = el}
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
                  ref={el => inputsRef.current[1] = el}
                  className="w-full px-3 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-[#f5f5f5] placeholder-[#737373] text-sm focus:outline-none focus:border-[#d4a84b] focus:bg-white/10 transition-all duration-200 pr-10"
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 bg-[#d4a84b] text-[#0a0a0a] rounded-lg font-semibold text-sm hover:bg-[#b8923f] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(212,168,75,0.2)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none mt-2 min-h-[44px]"
            >
              {loading ? 'Entrando...' : 'Entrar'}
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
            Não tem conta?{' '}
            <a href="/cadastro" className="text-[#d4a84b] font-medium hover:text-[#b8923f] hover:underline transition-colors">
              Criar conta
            </a>
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
