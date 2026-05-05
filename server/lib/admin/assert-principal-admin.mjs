import { getPerfilUsuario } from '../usuarios.mjs'
import { isSuperAdminEmail } from '../super-admin.mjs'

/** Contas com role ADMIN no banco ou o e-mail SUPER_ADMIN acessam /api/admin/*. */
export async function assertPrincipalAdmin(usuarioId) {
  if (!usuarioId) return { status: 401, message: 'Não autorizado.' }
  const perfil = await getPerfilUsuario(usuarioId)
  if (!perfil) return { status: 401, message: 'Não autorizado.' }
  const email = String(perfil.email || '').trim().toLowerCase()
  const role = String(perfil.role || 'USER').toUpperCase()
  if (isSuperAdminEmail(email) || role === 'ADMIN') return null
  return { status: 403, message: 'Acesso restrito a administradores.' }
}
