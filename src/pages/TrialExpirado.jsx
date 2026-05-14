import { Link, useNavigate } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'

function readUser() {
  try {
    const raw = localStorage.getItem('horizonte_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function handleLogout(navigate) {
  localStorage.removeItem('horizonte_user')
  navigate('/login', { replace: true })
}

export default function TrialExpirado() {
  const navigate = useNavigate()

  return (
    <div
      className="relative flex min-h-[100dvh] min-h-[100svh] w-full items-center justify-center overflow-hidden p-4 sm:p-6"
      style={{ backgroundColor: '#000000' }}
    >
      {/* ── Fundo escuro base ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden style={{ background: '#08090d' }} />

      {/* ── Spotlight gold vindo do topo ── */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(212,168,75,0.16) 0%, transparent 65%)' }}
      />

      {/* ── Acentos de canto ── */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 45% 35% at 100% 100%, rgba(212,168,75,0.05) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 0% 85%, rgba(99,102,241,0.06) 0%, transparent 50%)',
        }}
      />

      {/* ── Card ── */}
      <div className="relative w-full max-w-[420px]">

        {/* Linha de brilho no topo do card */}
        <div
          className="absolute -top-px left-10 right-10 h-px"
          aria-hidden
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,75,0.50), transparent)' }}
        />

        <div
          className="relative rounded-[24px] px-6 py-5 sm:px-7 sm:py-6"
          style={{
            background: '#000000',
            border: '1px solid rgba(212,168,75,0.16)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.03) inset, 0 32px 72px -16px rgba(0,0,0,0.90), 0 0 80px -25px rgba(212,168,75,0.14)',
          }}
        >

          {/* Logo */}
          <div className="flex justify-center mb-1">
            <img src={BRAND_ASSETS.logo} alt="Severino" className="w-full max-w-[440px] h-auto object-contain" />
          </div>

          {/* Badge "Período encerrado" */}
          <div className="mb-3 mt-1 flex justify-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-[5px] text-[11px] font-semibold uppercase tracking-widest"
              style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.20)',
                color: '#f87171',
              }}
            >
              <span
                className="h-[6px] w-[6px] rounded-full shrink-0"
                style={{ background: '#f87171' }}
              />
              Período gratuito encerrado
            </span>
          </div>

          {/* Headline — BAB: After (transformação vivida) */}
          <h1
            className="mb-2 text-center text-[21px] sm:text-[23px] font-bold leading-tight tracking-tight"
            style={{
              background: 'linear-gradient(140deg, #f0c96e 0%, #d4a84b 50%, #b8832a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            7 dias de clareza.<br />Não deixe acabar aqui.
          </h1>

          {/* Sub-headline — BAB: Before → After */}
          <p
            className="mb-3 text-center text-[12px] sm:text-[13px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.42)' }}
          >
            Você passou uma semana sabendo exatamente para onde foi cada real.{' '}
            <strong style={{ color: 'rgba(255,255,255,0.68)' }}>
              Sem planilha. Sem chute. Sem surpresa no fim do mês.
            </strong>
          </p>

          {/* Separador sutil */}
          <div
            className="mb-3 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
          />

          {/* O que eles construíram — ancoragem de perda */}
          <p
            className="mb-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            O que você vai perder se sair agora
          </p>
          <ul className="mb-3 space-y-2">
            {[
              'Histórico completo de entradas e saídas',
              'Lançamentos em segundos — até pelo WhatsApp',
              'Categorias automáticas que fazem sentido',
              'Agenda financeira e relatório mensal',
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-[12px] sm:text-[13px]"
                style={{ color: 'rgba(255,255,255,0.52)' }}
              >
                <span
                  className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: 'rgba(212,168,75,0.09)',
                    border: '1px solid rgba(212,168,75,0.20)',
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
                    <path
                      d="M1.5 4.5l2 2 4-4"
                      stroke="#d4a84b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* Agitação PAS — bloco de urgência */}
          <div
            className="mb-4 rounded-[14px] px-4 py-3"
            style={{
              background: 'rgba(248,113,113,0.05)',
              border: '1px solid rgba(248,113,113,0.12)',
            }}
          >
            <p className="text-[12px] sm:text-[13px] leading-relaxed text-center" style={{ color: 'rgba(255,255,255,0.46)' }}>
              Quem já saiu da névoa financeira sabe que{' '}
              <strong style={{ color: 'rgba(255,255,255,0.72)' }}>
                não vale a pena voltar pra ela.
              </strong>{' '}
              Assine e continue de onde parou.
            </p>
          </div>

          {/* CTA principal — Bridge (solução) */}
          <Link
            to="/pagamento"
            className="flex w-full items-center justify-center gap-2 rounded-[14px] py-3.5 text-[13px] sm:text-sm font-semibold no-underline transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #d4a84b 0%, #c49535 100%)',
              color: '#1a1200',
              boxShadow: '0 4px 24px rgba(212,168,75,0.26), 0 1px 0 rgba(255,255,255,0.16) inset',
            }}
          >
            Manter meu acesso
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3 7h8M7.5 4l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          {/* CTA secundário — "Já assino" */}
          <Link
            to="/pagamento"
            className="mt-2 flex w-full items-center justify-center rounded-[14px] py-3 text-[12px] sm:text-[13px] font-medium no-underline transition-all duration-200 hover:bg-white/[0.04] active:scale-[0.98]"
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.34)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            Já assino — verificar meu acesso
          </Link>

          {/* Trust reducers */}
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
              <rect x="1.5" y="4.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1" />
              <path d="M3.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              Sem fidelidade · Cancele quando quiser · Cartão ou Pix
            </p>
          </div>

          {/* Sair da conta */}
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => handleLogout(navigate)}
              className="text-[11px] transition-colors duration-150 hover:opacity-60 bg-transparent border-0 cursor-pointer p-0"
              style={{ color: 'rgba(255,255,255,0.18)' }}
            >
              Sair da conta
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
