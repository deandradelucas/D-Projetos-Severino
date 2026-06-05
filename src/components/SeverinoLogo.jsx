import SeverinoMark from './SeverinoMark'

// Lockup completo da marca para login/cadastro — tudo vetor nativo (crisp em
// qualquer zoom): símbolo SVG + "Severino" (Plus Jakarta) + tagline + 3 ícones.
const GOLD = '#d4a84b'
const NAVY = '#0d1117'
const TAG = '#4a5568'
const JAKARTA = "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif"

function Divider() {
  return <span aria-hidden className="h-5 w-px shrink-0" style={{ background: GOLD, opacity: 0.4 }} />
}

const ICON = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export default function SeverinoLogo({ className = '' }) {
  return (
    <div className={`flex select-none items-center gap-3 sm:gap-4 ${className}`}>
      <SeverinoMark className="h-14 w-14 shrink-0 sm:h-[4.25rem] sm:w-[4.25rem]" style={{ color: NAVY }} />
      <div className="flex flex-col">
        <span
          className="text-[2.05rem] font-extrabold leading-none tracking-[-0.02em] sm:text-[2.6rem]"
          style={{ color: NAVY, fontFamily: JAKARTA, fontVariationSettings: "'wght' 800" }}
        >
          Severino
        </span>
        <span aria-hidden className="mt-1.5 h-[2px] w-full rounded-full" style={{ background: GOLD }} />
        <span
          className="mt-1.5 w-full text-center text-[11px] font-medium tracking-[0.01em] sm:text-[13px]"
          style={{ color: TAG, fontFamily: JAKARTA }}
        >
          Finanças e agenda sob controle
        </span>
        {/* Ícones em cluster centralizado, próximos */}
        <div className="mt-2 flex w-full items-center justify-center gap-3 sm:gap-3.5" style={{ color: GOLD }}>
          {/* Finanças */}
          <svg {...ICON} aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v10" />
            <path d="M14.5 9.3c-.5-.8-1.5-1.3-2.6-1.3-1.5 0-2.6.8-2.6 1.9 0 1 .8 1.5 2.6 1.9 1.8.4 2.7 1 2.7 2.1 0 1.1-1.2 1.9-2.8 1.9-1.2 0-2.2-.5-2.7-1.3" />
          </svg>
          <Divider />
          {/* Agenda */}
          <svg {...ICON} aria-hidden>
            <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
            <path d="M8 2.5v4M16 2.5v4M3 10h18" />
            <path d="M7.5 14h.01M12 14h.01M16.5 14h.01M7.5 17.5h.01M12 17.5h.01" />
          </svg>
          <Divider />
          {/* Controle */}
          <svg {...ICON} aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="m8 12.2 2.6 2.6L16 9.4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
