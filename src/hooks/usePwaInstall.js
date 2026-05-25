import { useState, useEffect } from 'react'

function isIosSafari() {
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua) && !window.MSStream
  // iPadOS 13+ reporta como macOS — detectar via touch
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|mercury/i.test(ua)
  return (isIos || isIpadOs) && isSafari
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [canInstall, setCanInstall] = useState(false)
  // inicializa ios de forma síncrona para evitar flash de "não mostrar"
  const [ios] = useState(() => !isStandalone() && isIosSafari())
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    if (installed) return

    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }
    const onInstalled = () => setInstalled(true)

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [installed])

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
    setCanInstall(false)
  }

  return { canInstall, ios, installed, install }
}
