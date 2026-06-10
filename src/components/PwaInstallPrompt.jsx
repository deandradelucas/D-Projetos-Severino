import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BRAND_ASSETS } from '../lib/brandAssets'
import '../styles/legacy/PwaInstallPrompt.css'

/** Telas de entrada/conversão onde o convite de instalação compete com os CTAs. */
const HIDDEN_ROUTES = new Set([
  '/login',
  '/cadastro',
  '/bem-vindo-assinatura',
  '/trial-expirado',
  '/pagamento',
])

const DISMISS_AT_KEY = 'horizonte_pwa_install_dismissed_at'
const DISMISS_COUNT_KEY = 'horizonte_pwa_install_dismiss_count'
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const MAX_DISMISSALS = 5 // após 5 "agora não", não insiste mais
const SHOW_DELAY_MS = 60 * 1000 // só aparece após 1 min de uso (engajamento)

function isStandaloneMode() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

/** iOS (iPhone/iPad) — não dispara `beforeinstallprompt`; instalação é manual via Safari. */
function isIosDevice() {
  const ua = window.navigator.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
}

/** Chrome/Firefox/Edge/Opera no iOS: o passo a passo do Safari não se aplica
 * (o ícone de compartilhar fica em outro lugar). */
function isIosNonSafari() {
  return /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(window.navigator.userAgent || '')
}

function shouldSuppress() {
  try {
    const count = Number(window.localStorage.getItem(DISMISS_COUNT_KEY) || 0)
    if (count >= MAX_DISMISSALS) return true
    const at = Number(window.localStorage.getItem(DISMISS_AT_KEY) || 0)
    return at > 0 && Date.now() - at < DISMISS_WINDOW_MS
  } catch {
    return false
  }
}

export default function PwaInstallPrompt() {
  const { pathname } = useLocation()
  const [installEvent, setInstallEvent] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [iosMode, setIosMode] = useState(false)
  const [delayPassed, setDelayPassed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true)
      return undefined
    }
    if (shouldSuppress()) {
      return undefined
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallEvent(event)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    // iOS não tem beforeinstallprompt → mostra instruções manuais.
    if (isIosDevice()) setIosMode(true)

    // Timing: só aparece após 1 min na página (evita pedir cedo demais).
    const timer = window.setTimeout(() => setDelayPassed(true), SHOW_DELAY_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      window.clearTimeout(timer)
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
      setInstallEvent(null)
      setDismissed(true)
    }
  }

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISS_AT_KEY, String(Date.now()))
      const count = Number(window.localStorage.getItem(DISMISS_COUNT_KEY) || 0) + 1
      window.localStorage.setItem(DISMISS_COUNT_KEY, String(count))
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  const canShow =
    delayPassed &&
    !installed &&
    !dismissed &&
    !HIDDEN_ROUTES.has(pathname) &&
    (Boolean(installEvent) || iosMode)
  if (!canShow) {
    return null
  }

  const iconImg = (
    <img
      src={BRAND_ASSETS.appIconPng || BRAND_ASSETS.appIcon}
      alt=""
      className="pwa-install-sheet__icon"
      width={46}
      height={46}
      decoding="async"
    />
  )
  const closeBtn = (
    <button
      type="button"
      onClick={handleDismiss}
      className="pwa-install-sheet__close"
      aria-label="Fechar convite de instalação"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
    </button>
  )
  const benefits = (
    <ul className="pwa-install-sheet__benefits" aria-label="Benefícios do aplicativo instalado">
      <li>Mais rápido no celular</li>
      <li>Ícone dedicado</li>
      <li>Funciona offline</li>
    </ul>
  )

  // ── iOS: instalação manual (sem botão "Instalar") ──
  if (iosMode && !installEvent) {
    return (
      <aside className="pwa-install-sheet" role="dialog" aria-modal="false" aria-labelledby="pwa-install-title">
        <div className="pwa-install-sheet__glow" aria-hidden />
        {closeBtn}
        <div className="pwa-install-sheet__content">
          {iconImg}
          <div className="pwa-install-sheet__body">
            <p className="pwa-install-sheet__eyebrow">Instale no iPhone</p>
            <h2 className="pwa-install-sheet__title" id="pwa-install-title">Severino na tela inicial</h2>
            {isIosNonSafari() ? (
              <p className="pwa-install-sheet__text">
                Toque no menu de <strong>Compartilhar</strong> do navegador e depois em{' '}
                <strong>Adicionar à Tela de Início</strong> — ou abra este site no <strong>Safari</strong>.
              </p>
            ) : (
              <p className="pwa-install-sheet__text">
                No Safari, toque em{' '}
                <span className="pwa-install-sheet__ios-share" aria-hidden>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
                </span>{' '}
                Compartilhar e depois em <strong>Adicionar à Tela de Início</strong>.
              </p>
            )}
            {benefits}
          </div>
        </div>
        <div className="pwa-install-sheet__actions">
          <button
            type="button"
            onClick={handleDismiss}
            className="pwa-install-sheet__btn pwa-install-sheet__btn--primary"
          >
            Entendi
          </button>
        </div>
      </aside>
    )
  }

  // ── Android/Chrome: instalação com 1 toque ──
  return (
    <aside className="pwa-install-sheet" role="dialog" aria-modal="false" aria-labelledby="pwa-install-title">
      <div className="pwa-install-sheet__glow" aria-hidden />
      {closeBtn}
      <div className="pwa-install-sheet__content">
        {iconImg}
        <div className="pwa-install-sheet__body">
          <p className="pwa-install-sheet__eyebrow">App pronto para instalar</p>
          <h2 className="pwa-install-sheet__title" id="pwa-install-title">Severino na tela inicial</h2>
          <p className="pwa-install-sheet__text">
            Abra em tela cheia, com atalhos para Dashboard, Transações e Relatórios.
          </p>
          {benefits}
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
