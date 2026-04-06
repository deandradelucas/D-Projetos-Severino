import { runGoogleDriveBackup } from '../server/lib/google-drive-backup.mjs'

try {
  const result = await runGoogleDriveBackup({
    requestedBy: 'local-script',
  })

  console.log('Backup concluido com sucesso.')
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error('Falha ao executar backup no Google Drive.')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
