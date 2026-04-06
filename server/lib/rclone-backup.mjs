import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv } from './load-env.mjs'

const execAsync = promisify(exec)

const RCLONE_REMOTE = 'gdrive-backup'
const BACKUP_DIR = '.backup-temp'
const RCLONE_DEST = `${RCLONE_REMOTE}:d-mestremente/horizonte-financeiro`

function getEnv(name, { required = true, fallback = '' } = {}) {
  loadEnv()
  const value = process.env[name] ?? fallback
  if (required && !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return String(value).trim()
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

  const tables = ['usuarios']
  const backup = {
    app: 'Horizonte Financeiro',
    generatedAt: new Date().toISOString(),
    tables: {}
  }

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      console.warn(`[DB] Aviso ao buscar tabela ${table}: ${error.message}`)
      backup.tables[table] = []
    } else {
      backup.tables[table] = data ?? []
    }
  }

  return backup
}

async function createBackupArchive() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupName = `backup-${timestamp}`

  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }

  console.log('[FILES] Baixando dados do banco...')
  const dbBackup = await fetchDatabaseBackup()
  const dbFile = join(BACKUP_DIR, 'database.json')
  writeFileSync(dbFile, JSON.stringify(dbBackup, null, 2))

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
    const dest = join(projectFilesDir, item === '.env' ? '.env' : item)
    const itemDest = item.endsWith('/') ? projectFilesDir : projectFilesDir

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
    `powershell -command "Compress-Archive -Path '${BACKUP_DIR}\\database.json','${BACKUP_DIR}\\project-files' -DestinationPath '${archivePath}' -Force"`,
    'ZIP'
  )

  return { archivePath, backupName }
}

async function uploadToGoogleDrive(archivePath) {
  console.log('[DRIVE] Verificando configuração do rclone...')

  try {
    await execCommand(`rclone listremotes`, 'RCLONE')
  } catch {
    throw new Error(
      'rclone não está configurado. Execute: rclone config\n' +
      'Escolha "n" para novo remote, nomeie como "gdrive-backup", tipo "drive",\n' +
      'e autentique com sua conta d.mestremente@gmail.com'
    )
  }

  console.log('[DRIVE] Verificando remote gdrive-backup...')
  try {
    await execCommand(`rclone lsd ${RCLONE_REMOTE}:`, 'CHECK')
  } catch {
    throw new Error(
      `Remote "${RCLONE_REMOTE}" não encontrado. Execute: rclone config\n` +
      `Crie um remote chamado "${RCLONE_REMOTE}" do tipo Google Drive`
    )
  }

  console.log('[DRIVE] Enviando para Google Drive...')
  const fileName = archivePath.split(/[/\\]/).pop()
  await execCommand(
    `rclone copy "${archivePath}" "${RCLONE_DEST}/" --progress`,
    'UPLOAD'
  )

  console.log('[DRIVE] Listando arquivos no Drive...')
  const files = await execCommand(`rclone ls "${RCLONE_DEST}/"`, 'LIST')

  return {
    destination: RCLONE_DEST,
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
    const { archivePath: ap } = await createBackupArchive()
    archivePath = ap

    const result = await uploadToGoogleDrive(archivePath)

    console.log('\n' + '='.repeat(50))
    console.log('BACKUP CONCLUÍDO COM SUCESSO!')
    console.log('='.repeat(50))
    console.log(`Destino: ${result.destination}`)
    console.log(`Arquivo: ${result.fileName}`)
    console.log(`Arquivos no Drive: ${result.files.length}`)

    return result
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
