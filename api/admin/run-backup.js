import { runGoogleDriveBackup, validateBackupSecret } from '../../server/lib/google-drive-backup.mjs'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed.' })
  }

  const secret = req.headers['x-backup-secret']

  if (!validateBackupSecret(secret)) {
    return res.status(401).json({ message: 'Unauthorized backup request.' })
  }

  try {
    const result = await runGoogleDriveBackup({
      requestedBy: 'vercel-api',
    })

    return res.status(200).json({
      message: 'Backup enviado para o Google Drive com sucesso.',
      backup: result,
    })
  } catch (error) {
    console.error('run-backup failed', error)
    return res.status(500).json({
      message: 'Nao foi possivel concluir o backup no Google Drive.',
    })
  }
}
