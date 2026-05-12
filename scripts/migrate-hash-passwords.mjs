/**
 * Migra senhas em plaintext para bcrypt hash.
 * Executar UMA VEZ: node scripts/migrate-hash-passwords.mjs
 * Seguro re-executar: pula usuários que já têm hash bcrypt.
 */
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const BATCH = 100
let offset = 0
let migrated = 0
let skipped = 0

console.log('Iniciando migração de senhas para bcrypt...')

while (true) {
  const { data: rows, error } = await supabase
    .from('usuarios')
    .select('id, senha')
    .range(offset, offset + BATCH - 1)

  if (error) { console.error('Erro ao buscar usuários:', error.message); process.exit(1) }
  if (!rows || rows.length === 0) break

  for (const row of rows) {
    const senha = String(row.senha || '')
    if (!senha || senha.startsWith('$2b$') || senha.startsWith('$2a$')) {
      skipped++
      continue
    }
    const hash = await bcrypt.hash(senha, 10)
    const { error: upErr } = await supabase
      .from('usuarios')
      .update({ senha: hash })
      .eq('id', row.id)
    if (upErr) console.error(`Erro ao migrar usuário ${row.id}:`, upErr.message)
    else migrated++
  }

  if (rows.length < BATCH) break
  offset += BATCH
}

console.log(`Migração concluída. Migrados: ${migrated} | Já hash: ${skipped}`)
