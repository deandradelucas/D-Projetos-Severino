import { useEffect, useState } from 'react'
import { BRAND_ASSETS } from '../lib/brandAssets'

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallEvent(event)
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

    await installEvent.prompt()
    await installEvent.userChoice
    setVisible(false)
    setInstallEvent(null)
  }

  if (!visible || installed) {
    return null
  }

  return (
    <div className="fixed right-4 bottom-4 z-20 max-w-[320px] rounded-2xl border border-white/15 bg-black/75 p-4 text-[#f5f5f5] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md">
      <div className="flex items-start gap-3">
        <img
          src={BRAND_ASSETS.appIcon}
          alt="Horizonte Financeiro"
          className="h-11 w-11 shrink-0 rounded-xl bg-[#111111] p-1.5"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar app</p>
          <p className="mt-1 text-xs text-[#cfcfcf]">
            Adicione a Horizonte Financeiro na tela inicial para abrir como aplicativo.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-[#cfcfcf] transition hover:border-white/20 hover:text-white"
        >
          Agora nao
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-xl bg-[#d4a84b] px-3 py-2 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#b8923f]"
        >
          Instalar
        </button>
      </div>
    </div>
  )
}
