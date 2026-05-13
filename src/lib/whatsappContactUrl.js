/**
 * URL do atalho WhatsApp no front (Vite).
 * Ordem: `VITE_WHATSAPP_LINK` → `https://wa.me/{VITE_WHATSAPP_PHONE}` → fallback de suporte.
 * Alinha o título de ajuda do hub com uma única fonte de verdade (Dashboard, Transações).
 */

const DEFAULT_SUPPORT_WA = 'https://wa.me/5554992605447'

function trimEnv(key) {
  const v = import.meta.env?.[key]
  return typeof v === 'string' ? v.trim() : ''
}

export function getWhatsappContactUrl() {
  const link = trimEnv('VITE_WHATSAPP_LINK')
  if (link) return link
  const phone = trimEnv('VITE_WHATSAPP_PHONE').replace(/\D/g, '')
  if (phone) return `https://wa.me/${phone}`
  return DEFAULT_SUPPORT_WA
}
