import { useEffect, useState } from 'react'
import { BRAND_ASSETS } from '../lib/brandAssets'

const DISMISS_KEY = 'horizonte_pwa_install_dismissed_at'
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isStandaloneMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function wasDismissedRecently() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0)
  return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_WINDOW_MS
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true)
      return undefined
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallEvent(event)
      if (wasDismissedRecently()) {
        return
      }
      setVisible(true)
    }

    const handleInstalled = () => {
      setInstalled(true)
      setVisible(false)
      setInstallEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!installEvent) {
      return
    }

    try {
      await installEvent.prompt()
      await installEvent.userChoice
    } finally {
      setVisible(false)
      setInstallEvent(null)
    }
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible || installed) {
    return null
  }

  return (
    <aside className="pwa-install-sheet" role="dialog" aria-modal="false" aria-labelledby="pwa-install-title">
      <div className="pwa-install-sheet__glow" aria-hidden />
      <button
        type="button"
        onClick={handleDismiss}
        className="pwa-install-sheet__close"
        aria-label="Fechar convite de instalação"
      >
        ×
      </button>
      <div className="pwa-install-sheet__content">
        <img
          src={BRAND_ASSETS.appIconPng || BRAND_ASSETS.appIcon}
          alt=""
          className="pwa-install-sheet__icon"
          width={56}
          height={56}
          decoding="async"
        />

        <div className="pwa-install-sheet__body">
          <p className="pwa-install-sheet__eyebrow">App pronto para instalar</p>
          <h2 className="pwa-install-sheet__title" id="pwa-install-title">Horizonte na tela inicial</h2>
          <p className="pwa-install-sheet__text">
            Abra em tela cheia, com atalhos para Dashboard, Transações e Relatórios.
          </p>
          <ul className="pwa-install-sheet__benefits" aria-label="Benefícios do aplicativo instalado">
            <li>Mais rápido no celular</li>
            <li>Ícone dedicado</li>
          </ul>
        </div>
      </div>

      <div className="pwa-install-sheet__actions">
        <button
          type="button"
          onClick={handleDismiss}
          className="pwa-install-sheet__btn pwa-install-sheet__btn--ghost"
        >
          Agora não
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="pwa-install-sheet__btn pwa-install-sheet__btn--primary"
        >
          Instalar
        </button>
      </div>
    </aside>
  )
}
