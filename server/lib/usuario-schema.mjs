// @ts-check
/**
 * Alguns bancos legados usam a coluna `usuario` em `public.usuarios`;
 * o schema atual do projeto usa `nome`. Normalizamos para `nome` na API.
 */
export function normalizeUsuarioRow(row) {
  if (!row || typeof row !== 'object') return row
  const nome =
    row.nome != null && String(row.nome).trim() !== ''
      ? row.nome
      : (row.usuario ?? '')
  return { ...row, nome }
}

/**
 * Remove a senha E todo material secreto (`*_hash`: reset_token_hash,
 * email_otp_hash, registration_token_hash, etc.) antes de devolver um
 * registro de usuário para qualquer resposta de API. O regex `/_hash$/`
 * é à prova de futuro — qualquer coluna de hash criada depois é removida
 * automaticamente. (Auditoria squad 2026-06, C3.)
 */
export function stripSenha(row) {
  if (!row || typeof row !== 'object') return row
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'senha' || /_hash$/.test(k)) continue
    out[k] = v
  }
  return out
}
