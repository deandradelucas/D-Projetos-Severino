/** Sessão atual (sempre ler do localStorage ao disparar fetches — evita id desatualizado após merge de assinatura). */
export function readHorizonteUser() {
  try {
    const raw = localStorage.getItem('horizonte_user')
    if (!raw) return null
    const u = JSON.parse(raw)
    return u && typeof u === 'object' ? u : null
  } catch {
    return null
  }
}

const PERFIL_PADRAO = Object.freeze({ nome: 'Usuário', id: '' })

/**
 * Perfil mínimo para UI (nome exibível + id string).
 * Aceita legado `usuario` quando `nome` não existir.
 */
export function readHorizonteUserProfile() {
  const u = readHorizonteUser()
  if (!u) return { nome: PERFIL_PADRAO.nome, id: '' }
  const id = u.id != null ? String(u.id).trim() : ''
  let nome = PERFIL_PADRAO.nome
  if (typeof u.nome === 'string' && u.nome.trim()) nome = u.nome.trim()
  else if (typeof u.usuario === 'string' && u.usuario.trim()) nome = u.usuario.trim()
  return { nome, id }
}

export function horizonteUserProfileTemId(perfil) {
  return Boolean(perfil?.id && String(perfil.id).trim())
}
