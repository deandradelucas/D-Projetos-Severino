/**
 * E-mail da conta “principal” (não pode ser excluída nem rebaixada de ADMIN).
 * Outras contas com role ADMIN no banco também acessam /api/admin/* e o menu.
 * Sobrescreva com env SUPER_ADMIN_EMAIL se necessário.
 */
const DEFAULT_SUPER_ADMIN_EMAIL = 'mestredamente@mestredamente.com'

export function superAdminEmail() {
  return String(process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL)
    .trim()
    .toLowerCase()
}

export function isSuperAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === superAdminEmail()
}
