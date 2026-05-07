import { runRcloneBackup } from '../server/lib/rclone-backup.mjs'

console.log('Iniciando backup do Severino...\n')

try {
  await runRcloneBackup()
  console.log('\n✓ Backup concluído com sucesso!')
  process.exit(0)
} catch (error) {
  console.error('\n✗ Falha ao executar backup:', error.message)
  process.exit(1)
}
