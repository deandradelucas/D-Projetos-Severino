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

const PAINEL_USUARIO_PADRAO = Object.freeze({ nome: 'Usuário', email: '', id: '' })

/**
 * Estado inicial para páginas do painel (Dashboard, Transações): mescla sessão com defaults estáveis.
 */
export function readHorizonteUserPainelState() {
  const u = readHorizonteUser()
  if (!u) return { nome: PAINEL_USUARIO_PADRAO.nome, email: PAINEL_USUARIO_PADRAO.email, id: '' }
  return {
    ...PAINEL_USUARIO_PADRAO,
    ...u,
    id: u.id != null ? String(u.id).trim() : '',
  }
}

/**
 * Exibir "Lançado por …" nas listas quando há conta familiar partilhada (titular com ≥1 vinculado ou utilizador membro).
 * Definido em `buildAssinaturaUsuarioPayload` → `familia_mostrar_quem_lancou` (login / GET /api/assinatura/status).
 */
export function familiaMostrarQuemLancouNaUi(usuario) {
  if (!usuario || typeof usuario !== 'object') return false
  if (usuario.familia_mostrar_quem_lancou === true) return true
  // Sessões antigas sem o campo: membro já partilha dados com o titular.
  if (usuario.conta_familiar_membro === true) return true
  return false
}

/** Atualiza estado quando `AppSessionOutlet` ou outra parte grava sessão e dispara o evento. */
export function subscribeHorizonteSessionRefresh(callback) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => {
    try {
      callback(readHorizonteUser())
    } catch {
      callback(null)
    }
  }
  window.addEventListener('horizonte-session-refresh', handler)
  return () => window.removeEventListener('horizonte-session-refresh', handler)
}
