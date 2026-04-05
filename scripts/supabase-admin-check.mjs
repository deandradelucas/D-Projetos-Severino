import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

const envPath = path.resolve(process.cwd(), '.env')
loadEnvFile(envPath)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltam variaveis de ambiente. Verifique VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

async function checkUsuariosTable() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email')
    .limit(1)

  if (error) {
    const message = error.message || 'Erro desconhecido'
    console.error(`Falha ao acessar public.usuarios: ${message}`)

    if (message.includes("Could not find the table 'public.usuarios' in the schema cache")) {
      console.error('A tabela ainda nao existe no banco. Execute o SQL de src/scripts/setup_usuarios.sql no SQL Editor do Supabase.')
    }

    process.exit(1)
  }

  console.log('Conexao administrativa com Supabase OK.')
  console.log(`Tabela public.usuarios acessivel. Linhas retornadas nesta verificacao: ${data.length}`)
}

await checkUsuariosTable()
