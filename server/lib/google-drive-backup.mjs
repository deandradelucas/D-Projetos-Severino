import crypto from 'node:crypto'
import { loadEnv } from './load-env.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime'
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function getEnv(name, { required = true, fallback = '' } = {}) {
  const value = process.env[name] ?? fallback

  if (required && !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return String(value).trim()
}

function getGoogleDriveConfig() {
  loadEnv()

  return {
    clientEmail: getEnv('GOOGLE_DRIVE_CLIENT_EMAIL'),
    privateKey: getEnv('GOOGLE_DRIVE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    folderId: getEnv('GOOGLE_DRIVE_FOLDER_ID'),
    backupSecret: getEnv('BACKUP_SECRET'),
    filePrefix: getEnv('BACKUP_FILE_PREFIX', {
      required: false,
      fallback: 'horizonte-financeiro-backup',
    }),
  }
}

function buildServiceAccountJwt({ clientEmail, privateKey }) {
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }
  const payload = {
    iss: clientEmail,
    scope: GOOGLE_DRIVE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: nowInSeconds + 3600,
    iat: nowInSeconds,
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedToken)
    .end()
    .sign(privateKey)

  return `${unsignedToken}.${base64UrlEncode(signature)}`
}

async function getGoogleAccessToken(config) {
  const assertion = buildServiceAccountJwt(config)
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to obtain Google access token: ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

function createBackupFileName(prefix) {
  const iso = new Date().toISOString().replace(/[:.]/g, '-')
  return `${prefix}-${iso}.json`
}

async function fetchUsuariosBackupData() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

async function uploadBackupToDrive({ accessToken, folderId, fileName, payload }) {
  const boundary = `backup-boundary-${crypto.randomUUID()}`
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
  }

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(payload, null, 2),
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const response = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to upload backup to Google Drive: ${errorText}`)
  }

  return response.json()
}

export async function runGoogleDriveBackup({ requestedBy = 'manual' } = {}) {
  const config = getGoogleDriveConfig()
  const rows = await fetchUsuariosBackupData()
  const fileName = createBackupFileName(config.filePrefix)
  const payload = {
    app: 'Horizonte Financeiro',
    requestedBy,
    generatedAt: new Date().toISOString(),
    tables: {
      usuarios: rows,
    },
    summary: {
      usuarios: rows.length,
    },
  }

  const accessToken = await getGoogleAccessToken(config)
  const uploadedFile = await uploadBackupToDrive({
    accessToken,
    folderId: config.folderId,
    fileName,
    payload,
  })

  return {
    fileId: uploadedFile.id,
    fileName: uploadedFile.name,
    createdTime: uploadedFile.createdTime,
    webViewLink: uploadedFile.webViewLink || null,
    rowCount: rows.length,
  }
}

export function validateBackupSecret(secret) {
  const { backupSecret } = getGoogleDriveConfig()
  return Boolean(secret) && secret === backupSecret
}
