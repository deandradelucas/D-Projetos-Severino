import { Link, useNavigate } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { clearHorizonteAccessToken } from '../lib/horizonteAccessToken'
import './trial-expirado.css'

function readUser() {
  try {
    const raw = localStorage.getItem('horizonte_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function handleLogout(navigate) {
  clearHorizonteAccessToken()
  localStorage.removeItem('horizonte_user')
  navigate('/login', { replace: true })
}

const PERDAS = [
  'Seu histórico completo de entradas e saídas',
  'Lançar gasto em segundos — até pelo WhatsApp',
  'Notificações automáticas da sua agenda financeira',
]

export default function TrialExpirado() {
  const navigate = useNavigate()
  const user = readUser()
  const primeiroNome = (user?.nome || '').trim().split(/\s+/)[0] || ''
  const dias = Number(user?.trial_dias_gratis) || 7

  return (
    <div className="trial-screen relative flex min-h-[100dvh] min-h-[100svh] w-full items-center justify-center overflow-y-auto px-4 py-3">
      <div className="relative w-full max-w-[400px]">
        <div className="trial-topline absolute -top-px left-10 right-10 h-px" aria-hidden />

        <div className="trial-card relative rounded-[22px] px-5 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          {/* Logo */}
          <div className="mb-2.5 flex justify-center">
            <img src={BRAND_ASSETS.loginSeverinoLight} alt="Severino" className="h-auto w-full max-w-[108px] object-contain" />
          </div>

          {/* Badge */}
          <div className="mb-3 flex justify-center">
            <span className="trial-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[9.5px] font-semibold uppercase tracking-widest">
              <span className="trial-badge-dot h-[5px] w-[5px] shrink-0 rounded-full" />
              Seu período gratuito acabou
            </span>
          </div>

          {/* Headline */}
          <h1 className="trial-title mb-1.5 text-center text-[18px] font-bold leading-[1.18] tracking-tight sm:text-[19px]">
            {primeiroNome ? `Foram ${dias} dias de clareza, ${primeiroNome}. ` : `Foram ${dias} dias de clareza. `}
            <span className="trial-title-accent">Não deixe acabar aqui.</span>
          </h1>

          {/* Sub-headline */}
          <p className="trial-subtitle mb-3 text-center text-[11.5px] leading-snug sm:text-[12px]">
            Por uma semana você soube exatamente pra onde ia cada real — sem planilha, sem chute.{' '}
            <span className="trial-subtitle-strong">Assine e continue de onde parou.</span>
          </p>

          <div className="trial-divider mb-3 h-px" aria-hidden />

          {/* Perda */}
          <p className="trial-loss-label mb-1.5 text-[9.5px] font-semibold uppercase tracking-widest">
            O que você perde se parar agora
          </p>
          <ul className="mb-3 space-y-1">
            {PERDAS.map((item) => (
              <li key={item} className="trial-loss-item flex items-center gap-2.5 text-[12px] leading-snug">
                <span className="trial-loss-icon flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full">
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M2 5.5l2 2 4-4" stroke="#b8832a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* Urgência */}
          <div className="trial-urgency mb-3 rounded-[12px] px-3.5 py-2">
            <p className="trial-urgency-text text-center text-[11.5px] leading-snug">
              Quem saiu da névoa financeira sabe:{' '}
              <span className="trial-urgency-strong">não vale a pena voltar pra ela.</span>
            </p>
          </div>

          {/* CTA principal */}
          <Link
            to="/pagamento"
            className="trial-cta flex w-full items-center justify-center gap-2 rounded-[13px] py-2.5 text-[13px] font-semibold no-underline transition-all duration-200 hover:brightness-[1.04] active:scale-[0.98] sm:text-[13.5px]"
          >
            Quero manter meu acesso
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3 7h8M7.5 4l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          {/* CTA secundário */}
          <Link
            to="/pagamento"
            className="trial-cta-2 mt-1.5 flex w-full items-center justify-center rounded-[13px] py-2 text-[12px] font-medium no-underline transition-colors duration-200 active:scale-[0.98]"
          >
            Já assinei — liberar meu acesso
          </Link>

          {/* Suporte WhatsApp */}
          <a
            href="https://wa.me/5554996994482?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20a%20minha%20assinatura%20do%20Severino."
            target="_blank"
            rel="noopener noreferrer"
            className="trial-support mt-1.5 flex w-full items-center justify-center gap-2 rounded-[13px] py-2 text-[12px] font-semibold no-underline transition-colors duration-200 active:scale-[0.98]"
          >
            <svg width="15" height="15" viewBox="0 0 448 512" fill="currentColor" aria-hidden className="trial-support-icon">
              <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l140.9-37.4c32.4 17.7 68.9 27 106.1 27h.1c122.4 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.1c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.7-32.8-16.2-37.9-18-5.1-1.9-8.8-2.7-12.5 2.7-3.7 5.5-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.7-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
            </svg>
            Falar com suporte
          </a>

          {/* Trust */}
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden className="trial-trust-icon">
              <rect x="1.5" y="4.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1" />
              <path d="M3.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <p className="trial-trust-text text-[10px]">
              Sem fidelidade · Cancele quando quiser · Cartão ou Pix
            </p>
          </div>

          {/* Sair */}
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => handleLogout(navigate)}
              className="trial-logout cursor-pointer border-0 bg-transparent p-0 text-[11px] transition-colors duration-150"
            >
              Sair da conta
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
