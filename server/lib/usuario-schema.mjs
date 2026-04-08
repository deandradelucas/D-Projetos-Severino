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

export function stripSenha(row) {
  if (!row || typeof row !== 'object') return row
  const { senha: _s, ...rest } = row
  return rest
}
