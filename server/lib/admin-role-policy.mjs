import { isSuperAdminEmail } from './super-admin.mjs'

export function normalizeRoleKey(role) {
  return String(role || 'USER').trim().toUpperCase()
}

/** Só o e-mail SUPER_ADMIN pode atribuir papel ADMIN a outro usuário. */
export function actorCanAssignAdminRole(actorEmail) {
  return isSuperAdminEmail(actorEmail)
}
