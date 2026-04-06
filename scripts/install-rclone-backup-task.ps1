param(
  [string]$TaskName = 'HorizonteFinanceiroBackup',
  [string]$StartTime = '02:00'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$taskScript = Join-Path $PSScriptRoot 'run-rclone-backup.ps1'

if (-not (Test-Path $taskScript)) {
  throw "Arquivo nao encontrado: $taskScript"
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$taskScript`""

$trigger = New-ScheduledTaskTrigger -Daily -At $StartTime
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Executa o backup rclone do Horizonte Financeiro para o Google Drive.' `
  -Force | Out-Null

Write-Host "Tarefa agendada criada/atualizada com sucesso."
Write-Host "Nome: $TaskName"
Write-Host "Horario: $StartTime"
