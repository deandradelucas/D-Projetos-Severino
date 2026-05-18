import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { apiUrl } from '../lib/apiUrl'
import { horizonteApiAuthHeaders } from '../lib/apiAuthHeaders'

function readUser() {
  try {
    const raw = localStorage.getItem('horizonte_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function mergeUser(patch) {
  const u = readUser()
  if (!u) return
  localStorage.setItem('horizonte_user', JSON.stringify({ ...u, ...patch }))
}

const TRANSFORMACOES = [
  'Quanto sobra no mês — antes de gastar',
  'Quais hábitos estão te custando mais do que você imagina',
  'Quando você vai atingir sua próxima meta financeira',
]

export default function BemVindoAssinatura() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const user = readUser()
  const dias = Number(user?.trial_dias_gratis) || 7
  const trialEnd = user?.trial_ends_at ? new Date(user.trial_ends_at) : null
  const trialEndStr =
    trialEnd && !Number.isNaN(trialEnd.getTime())
      ? trialEnd.toLocaleString('pt-BR', { dateStyle: 'long' })
      : null

  useEffect(() => {
    const u = readUser()
    if (!u?.id) {
      navigate('/login', { replace: true })
      return
    }
    if (u.mostrar_bem_vindo_assinatura === false) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const u = readUser()
      if (!u?.id) return
      try {
        const res = await fetch(apiUrl('/api/assinatura/status'), {
          headers: horizonteApiAuthHeaders(),
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const a = await res.json()
        mergeUser(a)
        if (a.mostrar_bem_vindo_assinatura === false) {
          navigate('/dashboard', { replace: true })
        }
      } catch {
        /* mantém fluxo local */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleEntrarNoApp = async () => {
    setErr('')
    const u = readUser()
    if (!u?.id) {
      navigate('/login')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/assinatura/bem-vindo-visto'), {
        method: 'POST',
        headers: horizonteApiAuthHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Não foi possível continuar.')
      mergeUser({
        bem_vindo_pagamento_visto_at: data.bem_vindo_pagamento_visto_at,
        mostrar_bem_vindo_assinatura: data.mostrar_bem_vindo_assinatura,
        assinatura_paga: data.assinatura_paga,
        acesso_app_liberado: data.acesso_app_liberado,
        trial_ends_at: data.trial_ends_at,
        trial_dias_gratis: data.trial_dias_gratis,
      })
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setErr(e.message || 'Erro ao continuar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="relative flex min-h-[100dvh] min-h-[100svh] w-full items-start justify-center overflow-y-auto p-4 py-8 sm:p-6 sm:py-12"
      style={{ backgroundColor: '#08090d' }}
    >
      {/* ── Fundo base ── */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{ background: 'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(212,168,75,0.16) 0%, transparent 60%)' }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 45% 35% at 100% 100%, rgba(212,168,75,0.05) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 0% 85%, rgba(99,102,241,0.06) 0%, transparent 50%)',
        }}
      />

      <div className="relative w-full max-w-[480px]">
        {/* Linha de brilho no topo do card */}
        <div
          className="absolute -top-px left-10 right-10 h-px"
          aria-hidden
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,75,0.50), transparent)' }}
        />

        <div
          className="relative rounded-[28px] px-6 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7"
          style={{
            background: '#0b0c10',
            border: '1px solid rgba(212,168,75,0.14)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.03) inset, 0 40px 80px -20px rgba(0,0,0,0.92), 0 0 90px -30px rgba(212,168,75,0.12)',
          }}
        >

          {/* ══ MICRO SIM 1 — Validação da decisão ══
              Viés: Consistência (Cialdini) — confirma que a ação de se cadastrar foi a certa.
              Pergunta implícita respondida: "Eu fiz a escolha certa?" → SIM ✓              */}
          <div className="mb-6 text-center">
            <img
              src={BRAND_ASSETS.logo}
              alt="Severino"
              className="mx-auto mb-4 h-auto w-full max-w-[200px] object-contain"
            />

            <span
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-[5px] text-[11px] font-semibold uppercase tracking-widest"
              style={{
                background: 'rgba(212,168,75,0.10)',
                border: '1px solid rgba(212,168,75,0.26)',
                color: '#d4a84b',
              }}
            >
              <span className="relative flex h-[7px] w-[7px] shrink-0 items-center justify-center">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                  style={{ background: '#d4a84b' }}
                />
                <span
                  className="relative inline-flex h-[5px] w-[5px] rounded-full"
                  style={{ background: '#d4a84b' }}
                />
              </span>
              Conta criada — acesso liberado
            </span>

            <h1
              className="mb-2 text-[22px] font-bold leading-tight tracking-tight sm:text-[24px]"
              style={{
                background: 'linear-gradient(140deg, #f0c96e 0%, #d4a84b 50%, #b8832a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Você acabou de tomar a decisão mais importante da sua vida financeira.
            </h1>
            <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
              A maioria passa anos sabendo que precisa organizar o dinheiro — e não faz nada.{' '}
              <span style={{ color: 'rgba(255,255,255,0.60)' }}>
                Você fez. Isso já te coloca num grupo pequeno.
              </span>
            </p>
          </div>

          {/* Divisor */}
          <div
            className="mb-5 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }}
          />

          {/* ══ MICRO SIM 2 — Espelho da dor ══
              Viés: Reconhecimento + Empatia como ancoragem de confiança.
              Pergunta implícita respondida: "Você entende o que eu vivo?" → SIM ✓          */}
          <div
            className="mb-5 rounded-[16px] px-4 py-4"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.50)' }}>
              <span style={{ color: 'rgba(255,255,255,0.84)', fontWeight: 500 }}>
                Sabe aquela sensação de chegar no dia 20 sem entender pra onde foi o dinheiro?
              </span>{' '}
              Não é falta de esforço. É falta de visibilidade. Sem ver o dinheiro em tempo real,
              qualquer planejamento vira chute.
            </p>
          </div>

          {/* ══ MICRO SIM 3 — Transformação concreta ══
              Viés: Prospective hindsight — o usuário se imagina no futuro com o problema resolvido.
              Pergunta implícita respondida: "O que muda de verdade na minha vida?" → SIM ✓   */}
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'rgba(212,168,75,0.65)' }}
          >
            Com o Severino, você vai saber exatamente:
          </p>
          <ul className="mb-5 space-y-2.5">
            {TRANSFORMACOES.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-[13px]"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                <span
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: 'rgba(212,168,75,0.12)',
                    border: '1px solid rgba(212,168,75,0.24)',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path
                      d="M2 5.5l2 2 4-4"
                      stroke="#d4a84b"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* ══ MICRO SIM 4 — Prova social ══
              Viés: Prova social + identificação com persona similar.
              Pergunta implícita respondida: "Funciona pra pessoas como eu?" → SIM ✓          */}
          <div
            className="mb-5 rounded-[16px] px-4 py-3.5"
            style={{ background: 'rgba(212,168,75,0.04)', border: '1px solid rgba(212,168,75,0.10)' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'rgba(212,168,75,0.12)', border: '1px solid rgba(212,168,75,0.20)' }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                  <path
                    d="M1.5 10.5s1-3 5-3 5 3 5 3"
                    stroke="#d4a84b"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <circle cx="6.5" cy="4.5" r="2.5" stroke="#d4a84b" strokeWidth="1.2" />
                </svg>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <span style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
                  Mais de 2.300 pessoas
                </span>{' '}
                já pararam de se perguntar &quot;pra onde foi o meu dinheiro?&quot; — e finalmente
                têm uma resposta todo mês.
              </p>
            </div>
          </div>

          {/* ══ MICRO SIM 5 — Remoção do risco ══
              Viés: Inversão da aversão a perda — risco de assinar < risco de não assinar.
              Pergunta implícita respondida: "E se não funcionar pra mim?" → SIM ✓            */}
          <div
            className="mb-5 rounded-[16px] px-4 py-3.5"
            style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.14)' }}
          >
            <p className="mb-1 text-[12px] font-semibold" style={{ color: 'rgba(34,197,94,0.82)' }}>
              {dias} dias para você decidir com a cabeça fria — sem cartão agora.
            </p>
            <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Use tudo durante o trial. Se achar que não valeu, cancele com um clique — sem
              formulário, sem ligação, sem explicação.
              {trialEndStr && (
                <>
                  {' '}Seu acesso vai até{' '}
                  <strong style={{ color: 'rgba(255,255,255,0.62)' }}>{trialEndStr}</strong>.
                </>
              )}
            </p>
          </div>

          {/* ══ MICRO SIM 6 — Urgência real (sem manipulação) ══
              Viés: Custo de oportunidade + ancoragem de valor por comparação.
              Pergunta implícita respondida: "Por que agora e não depois?" → SIM ✓            */}
          <div className="mb-6 text-center">
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.36)' }}>
              Cada dia sem visibilidade financeira é um dia tomando decisões no escuro.{' '}
              <span style={{ color: 'rgba(255,255,255,0.50)' }}>
                O Severino custa menos que um almoço por mês.
              </span>
            </p>
          </div>

          {/* Divisor */}
          <div
            className="mb-5 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }}
          />

          {/* Erro */}
          {err && (
            <p className="mb-4 text-center text-[13px]" style={{ color: '#f87171' }}>
              {err}
            </p>
          )}

          {/* ══ SIM FINAL — Lead-in + CTAs ══
              Lead-in: amarra os 6 Micro SIMs e transforma assinar em continuidade natural.
              CTA primário: subscription (gold, prominence máxima).
              CTA secundário: rebaixado para link — remove paridade visual com o primário.    */}
          <p
            className="mb-4 text-center text-[13px] font-medium leading-snug"
            style={{ color: 'rgba(255,255,255,0.50)' }}
          >
            Você já fez a parte difícil: decidiu mudar.{' '}
            <span style={{ color: 'rgba(255,255,255,0.72)' }}>
              O próximo passo é garantir que essa decisão dure mais que a animação de hoje.
            </span>
          </p>

          <div className="flex flex-col gap-1">
            {/* CTA Primário — subscription */}
            <Link
              to="/pagamento"
              className="flex w-full items-center justify-center gap-2 rounded-[14px] py-3.5 text-[13px] font-semibold no-underline transition-all duration-200 hover:brightness-110 active:scale-[0.98] sm:text-sm"
              style={{
                background: 'linear-gradient(135deg, #d4a84b 0%, #c49535 100%)',
                color: '#1a1200',
                boxShadow: '0 4px 24px rgba(212,168,75,0.28), 0 1px 0 rgba(255,255,255,0.18) inset',
              }}
            >
              Garantir meu acesso completo
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                <path
                  d="M2.5 6.5h8M6.5 3l3.5 3.5L6.5 10"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            {/* Micro-copy de segurança */}
            <p className="mb-2 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.26)' }}>
              Cancele quando quiser. Sem burocracia.
            </p>

            {/* CTA Secundário — link de texto, não botão */}
            <button
              type="button"
              disabled={busy}
              onClick={handleEntrarNoApp}
              className="w-full py-2 text-center text-[12px] transition-colors duration-150 hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.28)' }}
            >
              {busy ? 'Entrando…' : 'Continuar explorando por agora'}
            </button>
          </div>

          {/* Trust footer */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              aria-hidden
              style={{ color: 'rgba(255,255,255,0.20)', flexShrink: 0 }}
            >
              <rect x="1.5" y="4.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1" />
              <path d="M3.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              Sem fidelidade · Cancele quando quiser · Asaas (cartão, Pix)
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
