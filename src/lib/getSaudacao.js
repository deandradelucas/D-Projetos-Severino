/**
 * Retorna uma saudação baseada na hora atual.
 * @returns {string} "Bom dia", "Boa tarde" ou "Boa noite"
 */
export function getSaudacao() {
  const hora = new Date().getHours()
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}
