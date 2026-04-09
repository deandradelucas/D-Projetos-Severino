/** Deve coincidir com server/lib/super-admin.mjs (env SUPER_ADMIN_EMAIL no servidor). */
export const SUPER_ADMIN_EMAIL = 'mestredamente@mestredamente.com'

export function isSuperAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
}

export function isSuperAdminSession() {
  try {
    const raw = localStorage.getItem('horizonte_user')
    if (!raw) return false
    const u = JSON.parse(raw)
    return isSuperAdminEmail(u?.email)
  } catch {
    return false
  }
}
