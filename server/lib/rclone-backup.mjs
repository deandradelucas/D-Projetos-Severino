import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv } from './load-env.mjs'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const DEFAULT_RCLONE_REMOTE = 'gdrive-backup'
const BACKUP_DIR = '.backup-temp'
const DEFAULT_RCLONE_DEST_PATH = 'Backup - Horizonte Financeiro'
const DEFAULT_SUPABASE_TABLES = ['usuarios']

function getEnv(name, { required = true, fallback = '' } = {}) {
  loadEnv()
  const value = process.env[name] ?? fallback
  if (required && !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return String(value).trim()
}

function getRcloneConfig() {
  const remote = getEnv('RCLONE_REMOTE', {
    required: false,
    fallback: DEFAULT_RCLONE_REMOTE,
  })
  const destPath = getEnv('RCLONE_DEST_PATH', {
    required: false,
    fallback: DEFAULT_RCLONE_DEST_PATH,
  })

  return {
    remote,
    destPath,
    destination: `${remote}:${destPath}`,
  }
}

function getSupabaseBackupTables() {
  const rawTables = getEnv('SUPABASE_BACKUP_TABLES', {
    required: false,
    fallback: DEFAULT_SUPABASE_TABLES.join(','),
  })

  return rawTables
    .split(',')
    .map((table) => table.trim())
    .filter(Boolean)
}

function getPostgresDumpConfig() {
  const databaseUrl =
    getEnv('SUPABASE_DB_URL', { required: false }) ||
    getEnv('DATABASE_URL', { required: false })

  if (databaseUrl) {
    return {
      enabled: true,
      mode: 'url',
      databaseUrl,
    }
  }

  const host = getEnv('PGHOST', { required: false })
  const port = getEnv('PGPORT', { required: false, fallback: '5432' })
  const user = getEnv('PGUSER', { required: false })
  const password = getEnv('PGPASSWORD', { required: false })
  const database = getEnv('PGDATABASE', { required: false })

  if (host && user && password && database) {
    return {
      enabled: true,
      mode: 'parts',
      host,
      port,
      user,
      password,
      database,
    }
  }

  return {
    enabled: false,
    reason: 'DATABASE_URL/SUPABASE_DB_URL or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE not configured.',
  }
}

async function execCommand(command, label) {
  console.log(`[${label}] Executando: ${command}`)
  const { stdout, stderr } = await execAsync(command, { shell: true })
  if (stderr && !stderr.includes('Progress')) {
    console.warn(`[${label}] Aviso: ${stderr}`)
  }
  return stdout
}

async function fetchDatabaseBackup() {
  console.log('[DB] Buscando dados do banco Supabase...')
  const { getSupabaseAdmin } = await import('./supabase-admin.mjs')
  const supabase = getSupabaseAdmin()

  const tables = getSupabaseBackupTables()
  const backup = {
    app: 'Horizonte Financeiro',
    provider: 'Supabase',
    generatedAt: new Date().toISOString(),
    tables: {},
    summary: {
      totalTables: tables.length,
      rowsByTable: {},
    },
  }

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      console.warn(`[DB] Aviso ao buscar tabela ${table}: ${error.message}`)
      backup.tables[table] = []
      backup.summary.rowsByTable[table] = 0
    } else {
      backup.tables[table] = data ?? []
      backup.summary.rowsByTable[table] = backup.tables[table].length
    }
  }

  return backup
}

async function createPostgresSqlDump(supabaseDir, backupName) {
  const dumpConfig = getPostgresDumpConfig()

  if (!dumpConfig.enabled) {
    console.warn(`[SUPABASE] Dump SQL completo ignorado: ${dumpConfig.reason}`)
    return null
  }

  const sqlDumpPath = join(supabaseDir, `${backupName}.sql`)

  try {
    await execFileAsync('pg_dump', ['--version'])
  } catch {
    console.warn('[SUPABASE] Dump SQL completo ignorado: pg_dump nao encontrado no PATH.')
    return null
  }

  console.log('[SUPABASE] Gerando dump SQL completo do Postgres...')

  const args = [
    '--format=plain',
    '--no-owner',
    '--no-privileges',
    `--file=${sqlDumpPath}`,
  ]

  const env = { ...process.env }

  if (dumpConfig.mode === 'url') {
    args.push(`--dbname=${dumpConfig.databaseUrl}`)
  } else {
    args.push(
      `--host=${dumpConfig.host}`,
      `--port=${dumpConfig.port}`,
      `--username=${dumpConfig.user}`,
      `--dbname=${dumpConfig.database}`,
    )
    env.PGPASSWORD = dumpConfig.password
  }

  await execFileAsync('pg_dump', args, { env })
  return sqlDumpPath
}

async function createBackupArchive() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupName = `backup-${timestamp}`

  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }

  console.log('[SUPABASE] Gerando snapshot do banco...')
  const dbBackup = await fetchDatabaseBackup()
  const supabaseDir = join(BACKUP_DIR, 'supabase')
  mkdirSync(supabaseDir, { recursive: true })
  const dbFile = join(supabaseDir, 'supabase-data.json')
  writeFileSync(dbFile, JSON.stringify(dbBackup, null, 2))
  const sqlDumpPath = await createPostgresSqlDump(supabaseDir, backupName)

  console.log('[FILES] Copiando arquivos do projeto...')
  const filesToBackup = [
    'package.json',
    'package-lock.json',
    'src/',
    'server/',
    'api/',
    'scripts/',
    '.env',
  ]

  const projectFilesDir = join(BACKUP_DIR, 'project-files')
  mkdirSync(projectFilesDir, { recursive: true })

  for (const item of filesToBackup) {
    const src = join(process.cwd(), item)

    if (existsSync(src)) {
      const cpCmd = item.endsWith('/')
        ? `xcopy /E /I /Y "${src}" "${projectFilesDir}\\${item.replace('/', '')}"`
        : `copy /Y "${src}" "${projectFilesDir}\\${item === '.env' ? '.env' : item.split('/').pop()}"`

      try {
        await execCommand(cpCmd, 'COPY')
      } catch (e) {
        console.warn(`[COPY] Aviso ao copiar ${item}: ${e.message}`)
      }
    }
  }

  const archiveName = `${backupName}.zip`
  const archivePath = join(BACKUP_DIR, archiveName)

  console.log('[ARCHIVE] Criando arquivo compactado...')
  await execCommand(
    `powershell -command "Compress-Archive -Path '${BACKUP_DIR}\\supabase','${BACKUP_DIR}\\project-files' -DestinationPath '${archivePath}' -Force"`,
    'ZIP'
  )

  return {
    archivePath,
    backupName,
    supabaseTables: Object.keys(dbBackup.tables),
    hasSqlDump: Boolean(sqlDumpPath),
  }
}

async function uploadToGoogleDrive(archivePath) {
  const rclone = getRcloneConfig()

  console.log('[DRIVE] Verificando configuração do rclone...')

  try {
    await execCommand(`rclone listremotes`, 'RCLONE')
  } catch {
    throw new Error(
      'rclone não está configurado. Execute: rclone config\n' +
      `Escolha "n" para novo remote, nomeie como "${rclone.remote}", tipo "drive",\n` +
      'e autentique com sua conta d.mestremente@gmail.com'
    )
  }

  console.log(`[DRIVE] Verificando remote ${rclone.remote}...`)
  try {
    await execCommand(`rclone lsd ${rclone.remote}:`, 'CHECK')
  } catch {
    throw new Error(
      `Remote "${rclone.remote}" não encontrado. Execute: rclone config\n` +
      `Crie um remote chamado "${rclone.remote}" do tipo Google Drive`
    )
  }

  console.log('[DRIVE] Enviando para Google Drive...')
  const fileName = archivePath.split(/[/\\]/).pop()
  await execCommand(
    `rclone copy "${archivePath}" "${rclone.destination}/" --progress`,
    'UPLOAD'
  )

  console.log('[DRIVE] Listando arquivos no Drive...')
  const files = await execCommand(`rclone ls "${rclone.destination}/"`, 'LIST')

  return {
    destination: rclone.destination,
    fileName,
    files: files.trim().split('\n').filter(Boolean)
  }
}

export async function runRcloneBackup() {
  console.log('='.repeat(50))
  console.log('HORIZONTE FINANCEIRO - BACKUP')
  console.log('='.repeat(50))

  let archivePath
  try {
    const { archivePath: ap, supabaseTables, hasSqlDump } = await createBackupArchive()
    archivePath = ap

    const result = await uploadToGoogleDrive(archivePath)

    console.log('\n' + '='.repeat(50))
    console.log('BACKUP CONCLUÍDO COM SUCESSO!')
    console.log('='.repeat(50))
    console.log(`Destino: ${result.destination}`)
    console.log(`Arquivo: ${result.fileName}`)
    console.log(`Tabelas Supabase: ${supabaseTables.join(', ')}`)
    console.log(`Dump SQL completo: ${hasSqlDump ? 'sim' : 'nao'}`)
    console.log(`Arquivos no Drive: ${result.files.length}`)

    return {
      ...result,
      supabaseTables,
      hasSqlDump,
    }
  } catch (error) {
    console.error('\n[ERRO] Falha no backup:', error.message)
    throw error
  } finally {
    if (archivePath && existsSync(BACKUP_DIR)) {
      console.log('[CLEANUP] Limpando arquivos temporários...')
      try {
        rmSync(BACKUP_DIR, { recursive: true, force: true })
      } catch { }
    }
  }
}
