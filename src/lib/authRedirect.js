/** Resposta 403 da API autenticada: assinatura expirada / sem acesso. */
export function redirectAssinaturaExpiradaSe403(res) {
  if (res.status !== 403) return false
  window.location.replace('/pagamento?expirado=1')
  return true
}
