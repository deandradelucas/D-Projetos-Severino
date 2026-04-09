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
