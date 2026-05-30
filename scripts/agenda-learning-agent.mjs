#!/usr/bin/env node
/**
 * @aprendizdaagenda — Agente de aprendizado da Agenda
 *
 * Roda diariamente (sugerido: 23h via cron).
 * 1. Busca títulos ruins das últimas 24h (usuario_editou OU qualidade_score < 0.5)
 * 2. Analisa padrões via Gemini
 * 3. Verifica se padrão já existe como regra ativa
 * 4. Insere proposta em agenda_learning_proposals
 * 5. Notifica via Telegram
 *
 * Cron (VPS):
 *   0 23 * * * cd /root/severino && node scripts/agenda-learning-agent.mjs >> /tmp/aprendiz-agenda.log 2>&1
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Env ──────────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env')
    const lines = readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1).trim()
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // .env ausente é aceitável — variáveis podem vir do ambiente
  }
}

loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[aprendiz] Variáveis Supabase não encontradas. Abortando.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: 'Markdown' }),
    })
    if (!res.ok) {
      // Tenta sem markdown se falhar
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: text.replace(/[*_`[\]()~>#+=|{}.!-]/g, '\\$&') }),
      })
    }
  } catch {
    // Telegram falha silenciosamente — não é crítico
  }
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function analyzeWithGemini(badTitles, activeRules) {
  if (!GEMINI_KEY) return null

  const activeRulesText = activeRules.length > 0
    ? activeRules.map((r, i) => `${i + 1}. ${r.regra_texto}`).join('\n')
    : 'Nenhuma regra ativa ainda.'

  const titlesText = badTitles
    .slice(0, 15)
    .map((t, i) => `${i + 1}. Título ruim: "${t.titulo_gerado}" | Transcrição: "${t.transcricao.slice(0, 120)}" | Causa: ${(t.flags ?? []).join(', ') || 'desconhecida'}`)
    .join('\n')

  const prompt = `Você é @aprendizdaagenda, especialista em melhorar a extração de títulos de eventos de agenda a partir de transcrições de voz em português.

REGRAS JÁ ATIVAS (não repita nem sugira variações dessas):
${activeRulesText}

TÍTULOS PROBLEMÁTICOS DETECTADOS HOJE (${badTitles.length} total, mostrando até 15):
${titlesText}

Analise os títulos problemáticos e identifique O PADRÃO mais importante que ainda não está coberto pelas regras ativas.

Responda com um JSON válido neste formato (e NADA mais):
{
  "tem_padrao_novo": true,
  "alteracao_titulo": "Título curto do problema (máx 60 chars)",
  "alteracao_descricao": "Explicação detalhada e clara do problema detectado, quantos títulos foram afetados, qual é a causa raiz e o que vai mudar. Escreva de forma que qualquer pessoa entenda, sem jargão técnico. Máx 300 chars.",
  "alteracao_tipo": "prompt_regra",
  "regra_nova": "Regra clara para adicionar ao prompt do Gemini. Ex: 'Nunca incluir horário no título. Remove padrões como às Xh, X horas, X:XX.'",
  "exemplos_ruins": [
    {"titulo_ruim": "título com problema", "transcricao": "trecho da fala original"}
  ],
  "conteudo_antes": "Como o prompt lida com isso hoje (se souber)",
  "conteudo_depois": "Como ficará depois da regra nova"
}

Se todos os padrões já estiverem cobertos pelas regras ativas, retorne:
{"tem_padrao_novo": false}`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch (err) {
    console.error('[aprendiz] Gemini error:', err.message)
    return null
  }
}

// ── Heurística de qualidade ───────────────────────────────────────────────────

function avaliarTitulo(titulo) {
  const flags = []
  if (/\d{1,2}[\s]?h(?:oras?)?\b/i.test(titulo)) flags.push('contem_hora')
  if (/\b(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo)\b/i.test(titulo)) flags.push('contem_dia_semana')
  if (/\b(lembre|agende|marque|coloca)\b/i.test(titulo)) flags.push('contem_verbo_agendamento')
  if (titulo.split(' ').length > 6) flags.push('muito_longo')
  if (/^\s*é\s*$|^\s*de\s*$|^\s*da\s*$/.test(titulo.trim())) flags.push('titulo_residual')
  const score = Math.max(0, 1 - flags.length * 0.25)
  return { flags, score }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  console.log(`[aprendiz] Rodando. Janela: desde ${since}`)

  // 1. Buscar títulos ruins
  const { data: logRows, error: logErr } = await supabase
    .from('agenda_title_log')
    .select('id, transcricao, titulo_gerado, fonte, qualidade_score, usuario_editou, flags, created_at')
    .gte('created_at', since)
    .or('usuario_editou.eq.true,qualidade_score.lt.0.5')
    .order('created_at', { ascending: false })
    .limit(50)

  if (logErr) {
    console.error('[aprendiz] Erro ao buscar logs:', logErr.message)
    process.exit(1)
  }

  const badTitles = logRows ?? []
  console.log(`[aprendiz] ${badTitles.length} título(s) problemático(s) encontrado(s).`)

  if (badTitles.length === 0) {
    console.log('[aprendiz] Nenhum título ruim hoje. Encerrando sem proposta.')
    process.exit(0)
  }

  // Calcular flags para títulos sem flags ainda
  const enriched = badTitles.map((row) => {
    if (row.flags && row.flags.length > 0) return row
    const { flags } = avaliarTitulo(row.titulo_gerado)
    return { ...row, flags }
  })

  // 2. Buscar regras já ativas
  const { data: rulesData } = await supabase
    .from('agenda_learned_rules')
    .select('regra_texto')
    .eq('ativo', true)

  const activeRules = rulesData ?? []

  // 3. Verificar se já há proposta pendente hoje (evita duplicata)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: existente } = await supabase
    .from('agenda_learning_proposals')
    .select('id')
    .is('aprovacao', null)
    .gte('created_at', todayStart.toISOString())
    .limit(1)

  if (existente && existente.length > 0) {
    console.log('[aprendiz] Já existe proposta pendente de hoje. Encerrando.')
    process.exit(0)
  }

  // 4. Analisar com Gemini
  const analysis = await analyzeWithGemini(enriched, activeRules)

  if (!analysis || !analysis.tem_padrao_novo) {
    console.log('[aprendiz] Gemini não identificou padrão novo. Encerrando.')
    process.exit(0)
  }

  // 5. Inserir proposta
  const exemplos = Array.isArray(analysis.exemplos_ruins) ? analysis.exemplos_ruins.slice(0, 3) : []

  const { data: inserted, error: insertErr } = await supabase
    .from('agenda_learning_proposals')
    .insert({
      agente: '@aprendizdaagenda',
      alteracao_titulo: analysis.alteracao_titulo ?? 'Melhoria identificada',
      alteracao_descricao: analysis.alteracao_descricao ?? '',
      alteracao_tipo: analysis.alteracao_tipo ?? 'prompt_regra',
      alteracao_conteudo: {
        regra_nova: analysis.regra_nova ?? '',
        before: analysis.conteudo_antes ?? '',
        after: analysis.conteudo_depois ?? '',
        descricao: analysis.alteracao_titulo ?? '',
      },
      exemplos_ruins: exemplos,
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('[aprendiz] Erro ao inserir proposta:', insertErr.message)
    process.exit(1)
  }

  console.log(`[aprendiz] Proposta criada: ${inserted.id}`)

  // 6. Notificar via Telegram
  const msg = [
    `🤖 *@aprendizdaagenda* identificou um padrão novo`,
    ``,
    `*${analysis.alteracao_titulo}*`,
    `${analysis.alteracao_descricao}`,
    ``,
    `📊 ${badTitles.length} título(s) afetado(s) hoje`,
    ``,
    `👉 Acesse *mestredamente.com/admin/framework* para aprovar ou rejeitar.`,
  ].join('\n')

  await sendTelegram(msg)
  console.log('[aprendiz] Notificação enviada. Concluído.')
}

main().catch((err) => {
  console.error('[aprendiz] Erro fatal:', err)
  process.exit(1)
})
