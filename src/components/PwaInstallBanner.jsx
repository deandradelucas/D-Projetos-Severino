import { useState } from 'react'
import { usePwaInstall } from '../hooks/usePwaInstall'

export default function PwaInstallBanner() {
  const { canInstall, ios, installed, install } = usePwaInstall()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-banner-dismissed') === '1'
  )

  function dismiss() {
    localStorage.setItem('pwa-banner-dismissed', '1')
    setDismissed(true)
  }

  if (installed || dismissed) return null
  if (!canInstall && !ios) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'var(--color-surface, #f8f8f8)',
      border: '1px solid var(--color-border, #e5e5e5)',
      borderRadius: '12px',
      padding: '12px 14px',
      marginBottom: '16px',
    }}>
      <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>📲</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {ios ? (
          <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.4, color: 'var(--color-text-secondary, #666)' }}>
            Instale o app: toque em{' '}
            <strong style={{ whiteSpace: 'nowrap' }}>
              Compartilhar{' '}
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>
              </svg>
            </strong>
            {' '}→ <strong>Adicionar à Tela Inicial</strong>
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.4, color: 'var(--color-text-secondary, #666)' }}>
            Instale o Severino para acesso rápido, sem abrir o navegador.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {canInstall && (
          <button
            onClick={install}
            style={{
              background: 'var(--color-primary, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Fechar"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary, #999)',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
