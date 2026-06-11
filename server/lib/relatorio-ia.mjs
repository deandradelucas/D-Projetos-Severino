import './load-env.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { aiTelemetrySnapshot } from './ai/ai-telemetry.mjs'
import { aiCacheGet, aiCacheSet } from './ai/ai-cache.mjs'
import { notifyTelegram } from './notify-telegram.mjs'
import { log } from './logger.mjs'

/**
 * Relatório semanal de correções de IA + watchdog de degradação.
 * Backend monta e ENVIA (Telegram); o n8n só agenda os endpoints de cron.
 * Ref: docs/analise-ia-entendimento-2026-06.md + docs/queries/relatorio-correcoes-ia.sql
 */

/** Formata a mensagem do relatório a partir do JSON da RPC. Pura (testável). */
export function formatarRelatorioIA(d) {
  const titulos = Number(d?.titulos_7d || 0)
  const editados = Number(d?.titulos_editados_7d || 0)
  const pctEditados = titulos > 0 ? Math.round((editados / titulos) * 100) : 0
  const fontes = Object.entries(d?.fontes_7d || {})
    .map(([f, n]) => `${f} ${n}`)
    .join(' · ') || '—'
  const corr = Number(d?.correcoes_categoria_7d || 0)
  const corrAnt = Number(d?.correcoes_categoria_7d_ant || 0)
  const tendencia = corr > corrAnt ? '↑' : corr < corrAnt ? '↓' : '='

  let msg =
    `📊 *Relatório IA — últimos 7 dias*\n\n` +
    `🗓️ *Agenda:* ${titulos} títulos gerados` +
    (titulos > 0 ? ` · score ${d?.score_medio_7d ?? '—'} · *${pctEditados}% editados*` : '') +
    `\n· fontes: ${fontes}\n\n` +
    `🏷️ *Categorias:* ${corr} correções (${tendencia} vs ${corrAnt} na semana anterior)\n` +
    `· heurística sobrepôs LLM: ${d?.heuristica_override_7d ?? 0}x\n` +
    `· transações no período: ${d?.transacoes_7d ?? 0}`

  const tops = Array.isArray(d?.top_correcoes_90d) ? d.top_correcoes_90d : []
  if (tops.length) {
    msg += `\n\n🔁 *Mais corrigidas (90d — candidatas a heurística):*\n` +
      tops.map((t) => `· "${t.descricao}" → ${t.categoria_nome} (${t.vezes}x)`).join('\n')
  }
  const edits = Array.isArray(d?.titulos_editados_30d) ? d.titulos_editados_30d : []
  if (edits.length) {
    msg += `\n\n✏️ *Títulos corrigidos (30d):*\n` +
      edits.map((t) => `· "${t.titulo_gerado}" → "${t.titulo_editado}"`).join('\n')
  }
  if (titulos === 0 && corr === 0) {
    msg += `\n\n_Sem sinais de erro na semana — volume ainda baixo p/ calibrar prompts._`
  }
  return msg
}

/** Gera o relatório (RPC no Supabase) e envia no Telegram. */
export async function processarRelatorioIACron() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('relatorio_correcoes_ia')
  if (error) throw new Error(`relatorio_correcoes_ia RPC: ${error.message}`)
  const msg = formatarRelatorioIA(data)
  await notifyTelegram(msg, { key: 'relatorio-ia-semanal', level: 'info', debounce: 'startup' })
  return { ok: true, enviado: true, dados: data }
}

// ---------------------------------------------------------------------------
// Watchdog — avalia a telemetria do dia e alerta degradação de IA.
// ---------------------------------------------------------------------------

/**
 * Regras sobre o snapshot de telemetria (`ia:<dia>:<provider>:<fluxo>:<resultado>`).
 * Pura (testável). Retorna lista de alertas {nivel, texto}.
 */
export function avaliarTelemetriaIA(snapshot) {
  const alertas = []
  let geminiOk = 0
  let geminiFail = 0
  let groqOk = 0
  for (const [k, v] of Object.entries(snapshot || {})) {
    if (k === 'dia') continue
    const n = Number(v) || 0
    if (k.startsWith('gemini:') && k.endsWith(':ok')) geminiOk += n
    if (k.startsWith('gemini:') && k.endsWith(':fail')) geminiFail += n
    if (k.startsWith('groq:') && k.endsWith(':ok')) groqOk += n
  }
  const totalGemini = geminiOk + geminiFail
  if (geminiFail >= 5 && totalGemini > 0 && geminiFail / totalGemini >= 0.3) {
    alertas.push({
      nivel: 'error',
      texto: `Gemini degradado hoje: *${geminiFail} falhas* em ${totalGemini} chamadas (${Math.round((geminiFail / totalGemini) * 100)}%). Verificar chave/quota — fallback Groq está segurando.`,
    })
  }
  if (groqOk >= 5) {
    alertas.push({
      nivel: 'warn',
      texto: `Fallback Groq ativo: *${groqOk} chamadas* atendidas pelo Groq hoje (Gemini falhando ou indisponível).`,
    })
  }
  return alertas
}

const WATCHDOG_DEDUPE_TTL_S = 2 * 60 * 60 // re-alerta no máximo a cada 2h

/** Roda o watchdog: lê a telemetria do dia, alerta no Telegram com dedupe de 2h. */
export async function processarWatchdogIACron() {
  const snapshot = await aiTelemetrySnapshot()
  const alertas = avaliarTelemetriaIA(snapshot)
  if (alertas.length === 0) return { ok: true, alertas: 0 }

  const dedupeKey = 'aic:watchdog-ia:last-alert'
  try {
    const recente = await aiCacheGet(dedupeKey)
    if (recente !== null) return { ok: true, alertas: alertas.length, suprimido: true }
  } catch { /* best-effort */ }

  const pior = alertas.some((a) => a.nivel === 'error') ? 'error' : 'warn'
  const msg = `🤖 *Watchdog IA*\n\n${alertas.map((a) => a.texto).join('\n\n')}`
  await notifyTelegram(msg, { key: 'watchdog-ia', level: pior, debounce: 'startup' })
  try { await aiCacheSet(dedupeKey, Date.now(), WATCHDOG_DEDUPE_TTL_S) } catch { /* noop */ }
  log.warn('[watchdog-ia] alerta enviado', { alertas: alertas.length })
  return { ok: true, alertas: alertas.length, enviado: true }
}
