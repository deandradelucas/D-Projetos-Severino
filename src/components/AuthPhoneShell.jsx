import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'

/**
 * Shell full-screen para Login e Cadastro.
 * Renderizado em document.body (portal) para centralização estável, sem herdar flex/overflow da app shell.
 */
export default function AuthPhoneShell({
  title,
  headerTitle,
  subtitle,
  showBack = false,
  backTo = '/login',
  children,
  footer,
  compact = false,
  showBodyLogo = false,
  heroImageSrc,
  heroImageAlt = '',
}) {
  const shell = (
    <div
      className={`auth-shell-glass fixed inset-0 z-[100] flex flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain text-neutral-900 lg:min-h-0 lg:flex-row ${heroImageSrc ? 'auth-shell-glass--hero' : 'auth-shell-glass--blobs'}`}
    >
      {heroImageSrc ? (
        <>
          {/* Mobile / tablet: foto full-bleed atrás do formulário */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden lg:hidden" aria-hidden="true">
            <img
              src={heroImageSrc}
              alt={heroImageAlt}
              className="absolute inset-0 h-full w-full object-cover object-center"
              decoding="async"
            />
            <div className="auth-shell-glass-hero-overlay auth-shell-glass-hero-overlay--mobile absolute inset-0" />
          </div>
          {/* Desktop: coluna da foto (sem cartão por cima) */}
          <div
            className="pointer-events-none relative z-0 hidden min-h-0 shrink-0 overflow-hidden lg:block lg:min-h-dvh lg:w-[min(50vw,560px)] xl:w-[min(46vw,620px)]"
            aria-hidden="true"
          >
            <img
              src={heroImageSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
              decoding="async"
            />
            <div className="auth-shell-glass-hero-overlay auth-shell-glass-hero-overlay--desktop absolute inset-0" />
          </div>
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-white" />
          <div className="absolute -left-[18%] top-[12%] h-[min(52vw,280px)] w-[min(52vw,280px)] rounded-full bg-purple-400/25 blur-[72px] sm:h-[300px] sm:w-[300px] sm:blur-[88px]" />
          <div className="absolute -right-[12%] top-[8%] h-[min(44vw,220px)] w-[min(44vw,220px)] rounded-full bg-orange-400/20 blur-[64px] sm:h-[260px] sm:w-[260px]" />
          <div className="absolute bottom-[14%] left-[6%] h-[min(48vw,240px)] w-[min(48vw,240px)] rounded-full bg-violet-400/18 blur-[80px] sm:left-[12%]" />
          <div className="absolute bottom-[22%] right-[4%] h-[180px] w-[180px] rounded-full bg-fuchsia-400/15 blur-[68px] max-sm:right-[-10%]" />
        </div>
      )}

      <div className="auth-shell-glass-form-column relative z-[1] box-border flex min-h-dvh w-full flex-1 flex-col justify-center px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 lg:min-h-dvh lg:px-10 xl:px-14">
        <div className="auth-shell-glass-card-reflect mx-auto w-full max-w-[400px] lg:max-w-[420px] xl:max-w-[440px]">
          <main
            className={`auth-shell-glass-card w-full rounded-[26px] border border-neutral-200/90 bg-white/40 px-7 py-9 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.14)] backdrop-blur-3xl backdrop-saturate-150 sm:rounded-[28px] sm:px-9 sm:py-10 ${
              compact ? 'sm:min-h-0' : ''
            }`}
          >
            {showBack ? (
              <Link
                to={backTo}
                className="mb-6 inline-grid h-9 w-9 cursor-pointer place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                aria-label="Voltar"
              >
                ←
              </Link>
            ) : null}

            {showBodyLogo ? (
              <div className="mb-6 flex justify-center">
                <div className="grid h-[56px] w-[56px] place-items-center rounded-[16px] border border-neutral-200/80 bg-white/80 shadow-[0_12px_40px_-22px_rgba(15,23,42,0.18)] backdrop-blur-md sm:h-[60px] sm:w-[60px]">
                  <img src={BRAND_ASSETS.appIconPng} alt="" className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden />
                </div>
              </div>
            ) : null}

            {headerTitle ? (
              <h1 className="text-center text-[1.65rem] font-semibold tracking-tight text-neutral-900 sm:text-[1.75rem]">
                {headerTitle}
              </h1>
            ) : (
              <h1 className="text-center text-[1.65rem] font-semibold tracking-tight text-neutral-900 sm:text-[1.75rem]">{title}</h1>
            )}

            {subtitle ? (
              <p className="mx-auto mt-2 max-w-[280px] text-center text-[13px] leading-snug text-neutral-500 sm:text-[14px]">{subtitle}</p>
            ) : null}

            <div className={headerTitle || title || subtitle || showBodyLogo ? 'mt-8' : ''}>{children}</div>

            {footer ? (
              <div className="mt-8 text-center text-[12px] font-medium text-neutral-600 sm:text-[13px]">{footer}</div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  )

  return createPortal(shell, document.body)
}
