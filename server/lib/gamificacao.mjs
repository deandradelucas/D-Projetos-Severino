// @ts-check
import { getSupabaseAdmin } from './supabase-admin.mjs'
import { hojeYmdBrt } from './date-brt.mjs'

/**
 * Gamificação — Fase 1 MVP (Story F2).
 *
 * Premia comportamento financeiro saudável. As 6 conquistas são DERIVADAS do
 * estado (metas, aportes, transações) e persistidas em `usuario_conquistas`
 * quando desbloqueadas — uma vez ganho, o selo é permanente. Celebração só na
 * tela (sem IA/WhatsApp nesta fase).
 */

/** Catálogo das conquistas do MVP. `icone` é a chave do line-icon no front. */
export const CONQUISTAS = [
  { key: 'meta_criada', nome: 'Primeira meta', descricao: 'Você criou sua primeira meta.', icone: 'target' },
  { key: 'meta_concluida', nome: 'Meta batida', descricao: 'Você concluiu uma meta. 🎯', icone: 'trophy' },
  { key: 'guardado_1k', nome: 'R$ 1 mil guardado', descricao: 'Você acumulou R$ 1.000 nas suas metas.', icone: 'coins' },
  { key: 'guardado_10k', nome: 'R$ 10 mil guardado', descricao: 'Você acumulou R$ 10.000 nas suas metas.', icone: 'gem' },
  { key: 'streak_7', nome: '7 dias seguidos', descricao: 'Você registrou por 7 dias seguidos.', icone: 'flame' },
  { key: 'streak_30', nome: '30 dias seguidos', descricao: 'Um mês inteiro de registros. 🔥', icone: 'flame' },
]

const CONQUISTA_KEYS = new Set(CONQUISTAS.map((c) => c.key))

// ── Lógica pura (testável sem banco) ────────────────────────────────────────

/** Dia anterior a uma data 'YYYY-MM-DD' (cálculo em UTC ao meio-dia, fuso-safe). */
export function prevDayYmd(ymd) {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Streak de dias consecutivos com registro, terminando em hoje ou ontem.
 * Permite 1 "freeze": um único dia sem registro no meio não zera; o 2º quebra.
 * @param {Set<string>} datas - datas BRT 'YYYY-MM-DD' com ≥1 registro
 * @param {string} hoje - 'YYYY-MM-DD' BRT de referência
 * @returns {number}
 */
export function calcularStreak(datas, hoje) {
  if (!(datas instanceof Set) || datas.size === 0) return 0
  const ontem = prevDayYmd(hoje)
  // Âncora: streak só "conta" se houve registro hoje ou ontem (senão já quebrou).
  let cursor
  if (datas.has(hoje)) cursor = hoje
  else if (datas.has(ontem)) cursor = ontem
  else return 0

  let streak = 0
  let freezeUsado = false
  while (true) {
    if (datas.has(cursor)) {
      streak += 1
      cursor = prevDayYmd(cursor)
    } else if (!freezeUsado && streak > 0) {
      freezeUsado = true // pula 1 buraco sem contar nem quebrar
      cursor = prevDayYmd(cursor)
    } else {
      break
    }
  }
  return streak
}

/**
 * Decide quais conquistas estão merecidas dado o estado agregado.
 * @param {{ temMeta: boolean, temMetaConcluida: boolean, totalGuardado: number, streak: number }} estado
 * @returns {Set<string>}
 */
export function conquistasMerecidas({ temMeta, temMetaConcluida, totalGuardado, streak }) {
  const m = new Set()
  if (temMeta) m.add('meta_criada')
  if (temMetaConcluida) m.add('meta_concluida')
  if (totalGuardado >= 1000) m.add('guardado_1k')
  if (totalGuardado >= 10000) m.add('guardado_10k')
  if (streak >= 7) m.add('streak_7')
  if (streak >= 30) m.add('streak_30')
  return m
}

// ── Acesso a dados + orquestração ───────────────────────────────────────────

const STREAK_JANELA_DIAS = 90

async function carregarEstado(supabase, usuarioId) {
  const [metasRes, txRes] = await Promise.all([
    supabase.from('metas').select('valor_guardado, concluida_em, arquivada_em').eq('usuario_id', usuarioId),
    supabase
      .from('transacoes')
      .select('criado_em')
      .eq('usuario_id', usuarioId)
      .gte('criado_em', new Date(Date.now() - STREAK_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString())
      .limit(5000),
  ])
  if (metasRes.error) throw metasRes.error
  if (txRes.error) throw txRes.error

  const metas = metasRes.data || []
  const ativas = metas.filter((m) => !m.arquivada_em)
  const totalGuardado = ativas.reduce((s, m) => s + (Number(m.valor_guardado) || 0), 0)
  const temMeta = metas.length > 0
  const temMetaConcluida = metas.some((m) => m.concluida_em != null)

  const datas = new Set()
  for (const t of txRes.data || []) {
    if (t.criado_em) datas.add(ymdBrtFromIso(t.criado_em))
  }
  const streak = calcularStreak(datas, hojeYmdBrt())

  return { temMeta, temMetaConcluida, totalGuardado, streak }
}

/** Converte um ISO timestamptz para data 'YYYY-MM-DD' no fuso BRT. */
function ymdBrtFromIso(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/**
 * Estado de gamificação do usuário: avalia, persiste novos desbloqueios e
 * retorna a lista completa de conquistas + streak. `novo:true` marca o que foi
 * desbloqueado NESTA chamada (front celebra uma vez).
 */
export async function getEstadoGamificacao(usuarioId) {
  const uid = String(usuarioId || '').trim()
  if (!uid) throw new Error('usuarioId obrigatório')
  const supabase = getSupabaseAdmin()

  const estado = await carregarEstado(supabase, uid)
  const merecidas = conquistasMerecidas(estado)

  const { data: jaDesbloqueadas, error: selErr } = await supabase
    .from('usuario_conquistas')
    .select('conquista_key, unlocked_em')
    .eq('usuario_id', uid)
  if (selErr) throw selErr

  const desbloqueadasMap = new Map((jaDesbloqueadas || []).map((r) => [r.conquista_key, r.unlocked_em]))

  // Novos desbloqueios = merecidas que ainda não estão persistidas.
  const novas = [...merecidas].filter((k) => CONQUISTA_KEYS.has(k) && !desbloqueadasMap.has(k))
  if (novas.length > 0) {
    const agora = new Date().toISOString()
    const { error: insErr } = await supabase
      .from('usuario_conquistas')
      .upsert(
        novas.map((k) => ({ usuario_id: uid, conquista_key: k, unlocked_em: agora })),
        { onConflict: 'usuario_id,conquista_key', ignoreDuplicates: true },
      )
    if (insErr) throw insErr
    novas.forEach((k) => desbloqueadasMap.set(k, agora))
  }
  const novasSet = new Set(novas)

  const conquistas = CONQUISTAS.map((c) => ({
    ...c,
    desbloqueada: desbloqueadasMap.has(c.key),
    unlocked_em: desbloqueadasMap.get(c.key) || null,
    novo: novasSet.has(c.key),
  }))

  return { conquistas, streak: { atual: estado.streak } }
}
