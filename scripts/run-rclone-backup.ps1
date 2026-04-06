$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Iniciando backup automatico do Horizonte Financeiro..."
& npm run backup:rclone

if ($LASTEXITCODE -ne 0) {
  throw "Falha ao executar npm run backup:rclone"
}

Write-Host "Backup automatico finalizado com sucesso."
