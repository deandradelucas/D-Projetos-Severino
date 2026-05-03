import { Link } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'

export default function AuthPhoneShell({ title, headerTitle, showBack = false, backTo = '/login', children, footer, compact = false }) {
  return (
    <div className="fixed inset-0 z-[20] min-h-dvh w-full overflow-y-auto bg-[#f3f4f7] px-4 py-6 text-[#0f172a]">
      <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full items-center justify-center">
        <main
          className={`relative w-full max-w-[300px] overflow-hidden rounded-[28px] bg-white shadow-[0_28px_70px_-36px_rgba(15,23,42,0.55)] ${
            compact ? 'min-h-[520px]' : 'min-h-[620px]'
          }`}
        >
          <section className="relative h-[155px] overflow-hidden bg-[#050505]">
            <div
              className="absolute inset-0 opacity-55"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 18px 18px, #171717 0 17px, transparent 18px), linear-gradient(135deg, transparent 0 42%, #171717 42% 58%, transparent 58%), radial-gradient(circle at 80% 20%, #141414 0 24px, transparent 25px)',
                backgroundSize: '56px 56px, 64px 64px, 72px 72px',
              }}
            />
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
              <h1 className="relative z-10 pt-8 text-center text-2xl font-medium tracking-[-0.04em] text-white">
                {headerTitle}
              </h1>
            ) : (
              <div className="relative z-10 flex h-full items-center justify-center pb-8">
                <div className="grid h-[58px] w-[58px] place-items-center rounded-[16px] bg-white shadow-[0_18px_40px_-20px_rgba(255,255,255,0.75)]">
                  <img src={BRAND_ASSETS.appIconPng} alt="Horizonte Financeiro" className="h-9 w-9" />
                </div>
              </div>
            )}
          </section>

          <section className="relative -mt-7 rounded-t-[34px] bg-white px-7 pb-7 pt-9">
            {!headerTitle && (
              <h1 className="mb-9 text-center text-[24px] font-medium tracking-[-0.04em] text-[#111827]">{title}</h1>
            )}
            {children}
            {footer ? <div className="mt-8 text-center text-[11px] font-medium text-[#111827]">{footer}</div> : null}
          </section>
        </main>
      </div>
    </div>
  )
}
