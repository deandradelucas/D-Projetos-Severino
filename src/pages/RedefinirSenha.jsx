import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage({ text: '', type: '' })

    if (!token) {
      setMessage({ text: 'Link invalido ou incompleto.', type: 'error' })
      return
    }

    if (password.length < 6) {
      setMessage({ text: 'A senha deve ter no minimo 6 caracteres.', type: 'error' })
      return
    }

    if (password !== confirmPassword) {
      setMessage({ text: 'As senhas nao coincidem.', type: 'error' })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ text: data.message || 'Nao foi possivel redefinir a senha.', type: 'error' })
        setLoading(false)
        return
      }

      setMessage({ text: 'Senha redefinida com sucesso. Voce ja pode entrar.', type: 'success' })
      setPassword('')
      setConfirmPassword('')
    } catch {
      setMessage({ text: 'Erro ao conectar com o servidor.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] min-h-[100svh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[380px] rounded-2xl border border-white/20 bg-black/50 p-5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-[2px] sm:p-6">
        <div className="mb-5 flex justify-center sm:mb-6">
          <img
            src="/images/horizonte_fiel_original_logo_dark.png"
            alt="Horizonte Financeiro"
            className="mx-auto block h-auto w-[230px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] sm:w-[270px]"
          />
        </div>

        <h1 className="mb-1 text-center text-xl font-semibold text-[#f5f5f5]">Redefinir senha</h1>
        <p className="mb-4 text-center text-xs text-[#a3a3a3]">
          Digite uma nova senha para acessar sua conta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#a3a3a3]" htmlFor="newPassword">
              Nova senha
            </label>
            <input
              id="newPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#737373] transition-all duration-200 focus:border-[#d4a84b] focus:bg-white/10 focus:outline-none"
              placeholder="Minimo 6 caracteres"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#a3a3a3]" htmlFor="confirmPassword">
              Confirmar nova senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#737373] transition-all duration-200 focus:border-[#d4a84b] focus:bg-white/10 focus:outline-none"
              placeholder="Repita a senha"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 min-h-[44px] w-full rounded-lg bg-[#d4a84b] py-2.5 text-sm font-semibold text-[#0a0a0a] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b8923f] hover:shadow-[0_0_30px_rgba(212,168,75,0.2)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {loading ? 'Redefinindo...' : 'Salvar nova senha'}
          </button>
        </form>

        {message.text && (
          <div
            className={`mt-3 rounded-lg border p-2 text-center text-xs ${
              message.type === 'success'
                ? 'border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.15)] text-[#22c55e]'
                : 'border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.15)] text-[#ef4444]'
            }`}
          >
            {message.text}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-[#a3a3a3]">
          <Link to="/login" className="font-medium text-[#d4a84b] transition-colors hover:text-[#b8923f] hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  )
}
