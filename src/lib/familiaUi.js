// Constantes e helpers puros de UI da seção Família (Configurações).
// Extraídos de pages/Configuracoes.jsx — sem dependência de React/DOM.

export const PAPEL_CONVITE_OPCOES = [
  { value: 'MEMBER', label: 'Membro — pode lançar e editar (exceto pagamento do titular)' },
  { value: 'VIEWER', label: 'Só leitura — não altera transações nem agenda' },
  { value: 'ADMIN', label: 'Administrador familiar — mesmo nível de escrita que membro' },
]

/** Rótulo legível do papel familiar. */
export function papelFamiliaLabel(p) {
  const x = String(p || '').toUpperCase()
  if (x === 'ADMIN') return 'Administrador familiar'
  if (x === 'VIEWER') return 'Só leitura'
  return 'Membro'
}

/** Tom/cor associado ao papel (admin | viewer | member). */
export function papelTone(p) {
  const x = String(p || '').toUpperCase()
  if (x === 'ADMIN') return 'admin'
  if (x === 'VIEWER') return 'viewer'
  return 'member'
}

/** Iniciais (até 2 letras) a partir do nome ou e-mail. */
export function inicial(nome, email) {
  const base = String(nome || email || '?').trim()
  return base.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}
