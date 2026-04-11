import { useState, useEffect } from 'react'
import { apiUrl } from '../lib/apiUrl'
import { getWhatsAppContactUrl } from '../lib/whatsappContactUrl'

/**
 * URL do botão WhatsApp: env estático primeiro; se vazio, tenta `/api/public/whatsapp-contact`.
 */
export function useWhatsAppContactUrl() {
  const [whatsappContactUrl, setWhatsappContactUrl] = useState(() => getWhatsAppContactUrl())

  useEffect(() => {
    if (whatsappContactUrl) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/public/whatsapp-contact'), { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const url = typeof data?.url === 'string' ? data.url.trim() : ''
        if (url && !cancelled) setWhatsappContactUrl(url)
      } catch {
        /* offline / API indisponível */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [whatsappContactUrl])

  return whatsappContactUrl
}
