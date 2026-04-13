/**
 * Deteção de ambiente (PWA / iOS) para mensagens e fallbacks de notificações.
 */

export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** Web app aberta a partir do ícone (ecrã principal), não no Safari normal. */
export function isStandalonePWAMode() {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    /* ignore */
  }
  if (typeof window.navigator !== 'undefined' && window.navigator.standalone === true) return true
  return false
}

/**
 * No iPhone, notificações Web no Safari em separador são pouco fiáveis.
 * Em PWA (ícone no ecrã), iOS 16.4+ passou a permitir mais cenários — ainda assim o Calendário (.ics) é o fallback mais seguro.
 */
export function iosWebNotificationsLikelyUnreliable() {
  return isIOSDevice() && !isStandalonePWAMode()
}
