/** Contato padrão (sobrescrito por VITE_WHATSAPP_LINK / VITE_WHATSAPP_PHONE). */
const DEFAULT_WHATSAPP_PHONE = '5547999895014'

/** URL para abrir conversa no WhatsApp (dashboard / CTAs). */
export function getWhatsAppContactUrl() {
  const link = import.meta.env.VITE_WHATSAPP_LINK?.trim()
  if (link) return link
  const phone = String(import.meta.env.VITE_WHATSAPP_PHONE || '').replace(/\D/g, '')
  if (phone) return `https://wa.me/${phone}`
  return `https://wa.me/${DEFAULT_WHATSAPP_PHONE}`
}
