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
  /** Se definido com `showBodyLogo`, exibe imagem larga (wordmark); senão mantém ícone quadrado. */
  bodyLogoSrc,
  /** Dimensões nativas do raster (`width`/`height` do PNG) — proporção correta e escalonamento mais limpo. */
  bodyLogoIntrinsicSize,
  bodyLogoAlt = '',
  heroImageSrc,
  heroImageAlt = '',
  /** Fundo branco sólido em toda a viewport (sem foto nem blobs decorativos). */
  plainWhiteBackground = false,
  /** Coluna de copy (login 50/50 em desktop; compacta no topo no mobile). */
  asidePanel = null,
  /** Se definido, não mostra o `<h1>` visível (ex.: login só com logo); mantém título para leitores de ecrã. */
  visuallyHiddenTitle,
}) {
  const srTitle = typeof visuallyHiddenTitle === 'string' ? visuallyHiddenTitle.trim() : ''
  const hasVisibleHeading = !srTitle && Boolean(headerTitle || title)
  const hasHeadingBlock = srTitle || headerTitle || title
  const logoTopClass = hasVisibleHeading ? 'mt-3 sm:mt-4' : 'mt-0 sm:mt-1'

  const isSplit = Boolean(asidePanel)

  const shellVariant = isSplit
    ? 'auth-shell-glass--split'
    : plainWhiteBackground
      ? 'auth-shell-glass--plain-white'
      : heroImageSrc
        ? 'auth-shell-glass--hero'
        : 'auth-shell-glass--blobs'

  const cardClassName = isSplit
    ? 'auth-shell-glass-card w-full border-0 bg-transparent px-0 py-0 shadow-none lg:px-2 lg:py-2'
    : plainWhiteBackground
      ? 'auth-shell-glass-card w-full rounded-[26px] border border-neutral-200/80 bg-white px-7 py-9 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.12)] sm:rounded-[28px] sm:px-9 sm:py-10'
      : 'auth-shell-glass-card w-full rounded-[26px] border border-neutral-200/90 bg-white/40 px-7 py-9 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.14)] backdrop-blur-3xl backdrop-saturate-150 sm:rounded-[28px] sm:px-9 sm:py-10'

  const shell = (
    <div
      className={`auth-shell-glass fixed inset-0 z-[100] flex min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain text-neutral-900 lg:min-h-0 lg:flex-row ${shellVariant}`}
    >
      {!isSplit && plainWhiteBackground ? (
        <div className="pointer-events-none absolute inset-0 z-0 bg-white" aria-hidden="true" />
      ) : !isSplit && heroImageSrc ? (
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
      ) : !isSplit ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-white" />
          <div className="absolute -left-[18%] top-[12%] h-[min(52vw,280px)] w-[min(52vw,280px)] rounded-full bg-purple-400/25 blur-[72px] sm:h-[300px] sm:w-[300px] sm:blur-[88px]" />
          <div className="absolute -right-[12%] top-[8%] h-[min(44vw,220px)] w-[min(44vw,220px)] rounded-full bg-orange-400/20 blur-[64px] sm:h-[260px] sm:w-[260px]" />
          <div className="absolute bottom-[14%] left-[6%] h-[min(48vw,240px)] w-[min(48vw,240px)] rounded-full bg-violet-400/18 blur-[80px] sm:left-[12%]" />
          <div className="absolute bottom-[22%] right-[4%] h-[180px] w-[180px] rounded-full bg-fuchsia-400/15 blur-[68px] max-sm:right-[-10%]" />
        </div>
      ) : null}

      {isSplit ? (
        <aside
          className="auth-shell-copy-column relative z-[1] order-1 box-border w-full shrink-0 lg:order-none lg:flex lg:min-h-dvh lg:w-1/2 lg:flex-col lg:justify-center"
          aria-label="Sobre o Severino"
        >
          <div className="auth-shell-copy-column__inner">{asidePanel}</div>
        </aside>
      ) : null}

      <div
        className={`auth-shell-glass-form-column relative z-[1] box-border flex min-h-0 w-full flex-1 flex-col justify-center px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 lg:min-h-dvh lg:px-10 xl:px-14 ${isSplit ? 'order-2 lg:w-1/2 lg:shrink-0 lg:flex-none' : ''}`}
      >
        <div
          className={`mx-auto w-full max-w-[400px] lg:max-w-[420px] xl:max-w-[440px] ${plainWhiteBackground || isSplit ? '' : 'auth-shell-glass-card-reflect'}`}
        >
          <main className={`${cardClassName} ${compact ? 'sm:min-h-0' : ''}`}>
            {showBack ? (
              <Link
                to={backTo}
                className="mb-6 inline-grid h-9 w-9 cursor-pointer place-items-center rounded-full text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                aria-label="Voltar"
              >
                ←
              </Link>
            ) : null}

            {srTitle ? <h1 className="sr-only">{srTitle}</h1> : null}
            {!srTitle && headerTitle ? (
              <h1 className="text-center text-[1.65rem] font-semibold tracking-tight text-neutral-900 sm:text-[1.75rem]">
                {headerTitle}
              </h1>
            ) : null}
            {!srTitle && !headerTitle && title ? (
              <h1 className="text-center text-[1.65rem] font-semibold tracking-tight text-neutral-900 sm:text-[1.75rem]">{title}</h1>
            ) : null}

            {showBodyLogo ? (
              <div className={`flex justify-center ${logoTopClass}`}>
                {bodyLogoSrc ? (
                  <div className="flex w-full max-w-[min(420px,96vw)] items-center justify-center sm:max-w-[min(440px,98vw)] lg:max-w-[min(560px,94vw)]">
                    <img
                      src={bodyLogoSrc}
                      alt={bodyLogoAlt || 'Logo'}
                      className="h-auto max-h-[7rem] w-auto max-w-full object-contain object-center sm:max-h-[9rem] lg:max-h-[13rem]"
                      width={bodyLogoIntrinsicSize?.width}
                      height={bodyLogoIntrinsicSize?.height}
                      decoding="sync"
                    />
                  </div>
                ) : (
                  <div className="grid h-[56px] w-[56px] place-items-center rounded-[16px] border border-neutral-200/80 bg-white/80 shadow-[0_12px_40px_-22px_rgba(15,23,42,0.18)] backdrop-blur-md sm:h-[60px] sm:w-[60px]">
                    <img src={BRAND_ASSETS.appIconPng} alt="" className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden />
                  </div>
                )}
              </div>
            ) : null}

            {subtitle ? (
              <p
                className={`mx-auto max-w-[280px] text-center text-[13px] leading-snug text-neutral-500 sm:text-[14px] ${showBodyLogo ? 'mt-3' : 'mt-2'}`}
              >
                {subtitle}
              </p>
            ) : null}

            <div className={hasHeadingBlock || subtitle || showBodyLogo ? 'mt-8' : ''}>{children}</div>

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
