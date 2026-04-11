/** Primeiro token do nome para saudação (“Olá, Maria”). */
export function primeiroNomeExibicao(usuario) {
  const n = String(usuario?.nome || usuario?.usuario || '').trim()
  if (!n) return 'usuário'
  const primeiro = n.split(/\s+/)[0]
  return primeiro || 'usuário'
}
