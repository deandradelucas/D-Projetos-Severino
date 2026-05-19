#!/usr/bin/env node
/**
 * Monitor de crashes do PM2 — roda via cron a cada 5 minutos.
 * Detecta restarts comparando PID do processo e testa o health endpoint.
 *
 * Setup na VPS (já instalado via script de configuração):
 *   crontab -e
 *   * /5 * * * * cd /home/lucas/severino && node scripts/pm2-crash-monitor.mjs >> /tmp/pm2-monitor.log 2>&1
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import '../server/lib/load-env.mjs'
import { Alerts, notifyTelegram } from '../server/lib/notify-telegram.mjs'

const STATE_FILE = '/tmp/pm2-crash-monitor-state.json'
const PID_FILE   = '/root/.pm2/pids/severino-0.pid'
const HEALTH_URL = 'http://127.0.0.1:3001/api/health'

function readState() {
  if (!existsSync(STATE_FILE)) return {}
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch { return {} }
}

function saveState(state) {
  try { writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8') } catch { /* ignore */ }
}

function readPid() {
  try { return parseInt(readFileSync(PID_FILE, 'utf8').trim()) } catch { return null }
}

function isProcessAlive(pid) {
  if (!pid) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

async function checkHealth() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch { return false }
}

async function main() {
  const now = Date.now()
  const state = readState()
  const currentPid = readPid()
  const prevPid = state.pid ?? currentPid
  const lastCheck = state.checkedAt ?? now

  const pidChanged = currentPid && prevPid && currentPid !== prevPid
  const timeSinceLastCheck = now - lastCheck

  console.log(`[pm2-monitor] pid=${currentPid} prevPid=${prevPid} pidChanged=${pidChanged}`)

  // Detecta restart por mudança de PID
  if (pidChanged) {
    const minutesSince = Math.round(timeSinceLastCheck / 60000)
    console.log(`[pm2-monitor] Restart detectado após ~${minutesSince} min (PID ${prevPid} → ${currentPid}) — notificando`)
    await Alerts.pm2Crash(1)
  }

  // Verifica se processo está vivo
  const alive = isProcessAlive(currentPid)
  if (!alive) {
    console.log(`[pm2-monitor] Processo PID ${currentPid} não está vivo`)
  }

  // Verifica health endpoint
  const healthy = await checkHealth()
  console.log(`[pm2-monitor] health=${healthy} alive=${alive}`)

  if (!healthy) {
    await notifyTelegram(
      `🚨 *Servidor fora do ar*\n\nHealth check falhou em \`${HEALTH_URL}\`\n\nVerifique: \`pm2 logs severino --lines 50\``,
      { key: 'health-fail', level: 'error', debounce: 'critical' },
    )
  }

  saveState({ pid: currentPid, checkedAt: now, healthy })
}

main().catch((err) => console.error('[pm2-monitor] Erro:', err?.message))
