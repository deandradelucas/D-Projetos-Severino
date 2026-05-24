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

export function getWhatsappContactUrl(text) {
  const link = trimEnv('VITE_WHATSAPP_LINK')
  const base = link || (() => {
    const phone = trimEnv('VITE_WHATSAPP_PHONE').replace(/\D/g, '')
    return phone ? `https://wa.me/${phone}` : DEFAULT_SUPPORT_WA
  })()
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function getWhatsappOnboardingUrl() {
  return getWhatsappContactUrl('como funciona')
}
