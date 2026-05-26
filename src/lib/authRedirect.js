import { forceLogout } from './authRefresh'

/** Resposta 401: sessão expirada — limpa dados e redireciona para login. */
export function redirectSe401(res) {
  if (res.status !== 401) return false
  forceLogout()
  return true
}

/** Resposta 403 da API autenticada: assinatura expirada / sem acesso. */
export function redirectAssinaturaExpiradaSe403(res) {
  if (res.status !== 403) return false
  window.location.replace('/trial-expirado')
  return true
}
