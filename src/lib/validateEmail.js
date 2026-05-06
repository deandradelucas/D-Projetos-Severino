/** Validação simples de e-mail para formulários de auth (login/cadastro). */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
