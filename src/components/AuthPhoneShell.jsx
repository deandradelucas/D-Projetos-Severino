import { Link } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'

export default function AuthPhoneShell({
  title,
  headerTitle,
  showBack = false,
  backTo = '/login',
  children,
  footer,
  compact = false,
  showBodyLogo = false,
}) {
  return (
    <div className="fixed inset-0 z-[20] min-h-dvh w-full overflow-y-auto bg-[#f3f4f7] p-0 text-[#0f172a] sm:px-4 sm:py-6">
      <div className="mx-auto flex min-h-dvh w-full items-stretch justify-start sm:min-h-[calc(100dvh-48px)] sm:items-center sm:justify-center">
        <main
          className={`relative flex min-h-dvh w-full max-w-none flex-col overflow-hidden rounded-none bg-white shadow-none sm:max-w-[300px] sm:rounded-[28px] sm:shadow-[0_28px_70px_-36px_rgba(15,23,42,0.55)] ${
            compact ? 'sm:min-h-[520px]' : 'sm:min-h-[620px]'
          }`}
        >
          <section className="relative h-[220px] shrink-0 overflow-hidden bg-[#000000] sm:h-[155px]">
            {showBack && (
              <Link
                to={backTo}
                className="absolute left-4 top-7 z-10 grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="Voltar"
              >
                ←
              </Link>
            )}
            {headerTitle ? (
              <h1 className="relative z-10 pt-12 text-center text-3xl font-medium tracking-[-0.04em] !text-white sm:pt-8 sm:text-2xl">
                {headerTitle}
              </h1>
            ) : (
              <div className="relative z-10 flex h-full items-center justify-center pb-8">
                <div className="grid h-[76px] w-[76px] place-items-center rounded-[22px] bg-white shadow-[0_18px_40px_-20px_rgba(255,255,255,0.75)] sm:h-[58px] sm:w-[58px] sm:rounded-[16px]">
                  <img src={BRAND_ASSETS.appIconPng} alt="Horizonte Financeiro" className="h-12 w-12 sm:h-9 sm:w-9" />
                </div>
              </div>
            )}
          </section>

          <section className="relative -mt-9 flex flex-1 flex-col rounded-tl-[42px] rounded-tr-none bg-white px-9 pb-[max(28px,env(safe-area-inset-bottom))] pt-12 sm:-mt-7 sm:rounded-tl-[34px] sm:px-7 sm:pb-7 sm:pt-9">
            {showBodyLogo ? (
              <div className="mb-10 flex justify-center sm:mb-9">
                <div className="grid h-[64px] w-[64px] place-items-center rounded-[18px] bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-[#eef0f4]">
                  <img src={BRAND_ASSETS.appIconPng} alt="Horizonte Financeiro" className="h-10 w-10" />
                </div>
              </div>
            ) : !headerTitle ? (
              <h1 className="mb-10 text-center text-[32px] font-medium tracking-[-0.04em] text-[#111827] sm:mb-9 sm:text-[24px]">{title}</h1>
            ) : null}
            {children}
            {footer ? <div className="mt-8 text-center text-[11px] font-medium text-[#111827]">{footer}</div> : null}
          </section>
        </main>
      </div>
    </div>
  )
}
