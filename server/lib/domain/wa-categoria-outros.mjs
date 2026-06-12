import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { log } from '../logger.mjs'
import { setPendente, getPendente, clearPendente } from './wa-pendente.mjs'
import { logCorrecaoCategoria } from './transacao-categoria-logger.mjs'

/**
 * Follow-up quando o lançamento do WhatsApp cai em "Outros" (plano anti-Outros,
 * Fase 1.1): o bot salva normalmente (não trava o fluxo) e pergunta na sequência
 * em qual categoria encaixa, com opções numeradas. A resposta recategoriza a
 * transação E vira aprendizado (merchant memory) — da próxima vez nem pergunta.
 */

const MAX_OPCOES = 9 // resposta de 1 dígito (mesmo padrão dos outros menus)

/** É a categoria fallback "Outros"? */
export function isCategoriaOutros(categoria) {
  return String(categoria?.nome || '').trim().toLowerCase() === 'outros'
}

/**
 * Monta a pergunta numerada com as categorias do tipo (exceto Outros).
 * Retorna { texto, opcoes } ou null se não houver alternativas.
 */
export function montarPerguntaCategoriaOutros(categorias, tipoTx) {
  const tipo = String(tipoTx || '').toUpperCase()
  const candidatas = (categorias || [])
    .filter((c) => c.tipo === tipo && !isCategoriaOutros(c))
    .slice(0, MAX_OPCOES)
  if (!candidatas.length) return null
  const linhas = candidatas.map((c, i) => `${i + 1}) ${c.nome}`).join('\n')
  return {
    texto: `\n\n🏷️ Não achei uma categoria certa, ficou em *Outros*. Em qual encaixa?\n${linhas}\n_Responda o número (ou ignore pra deixar assim)._`,
    opcoes: candidatas.map((c) => ({ id: c.id, nome: c.nome })),
  }
}

/** Grava a pendência (TTL 5 min, mesmo mecanismo dos menus de lista). */
export async function registrarPendenteCategoriaOutros(phone, { transacaoId, tipo, descricao, opcoes }) {
  await setPendente(phone, {
    tipo: 'categoria_outros',
    transacao_id: transacaoId,
    tx_tipo: tipo,
    descricao: String(descricao || '').slice(0, 120),
    opcoes,
  })
}

/**
 * T2: trata a resposta numérica à pergunta de categoria. Retorna a reply ou
 * null (mensagem não é pra este pendente — segue o fluxo normal do bot).
 */
export async function responderPendenteCategoria(dataUsuarioId, actorId, phone, message) {
  const msg = String(message || '').trim()
  if (!/^[1-9]$/.test(msg)) return null
  let pend
  try {
    pend = await getPendente(phone)
  } catch {
    return null
  }
  if (!pend || pend.tipo !== 'categoria_outros') return null

  const escolha = pend.opcoes?.[Number.parseInt(msg, 10) - 1]
  if (!escolha) {
    return { ok: true, reply: `Responda um número de *1* a *${pend.opcoes?.length || 1}*.` }
  }
  await clearPendente(phone).catch(() => {})

  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('transacoes')
      .update({ categoria_id: escolha.id, subcategoria_id: null, atualizado_em: new Date().toISOString() })
      .eq('id', pend.transacao_id)
      .eq('usuario_id', dataUsuarioId)
      .select('id')
      .maybeSingle()
    if (error || !data) throw error || new Error('transação não encontrada')

    // Aprendizado: a escolha vira correção (merchant memory) — próxima vez acerta direto.
    if (pend.descricao) {
      logCorrecaoCategoria(actorId, pend.descricao, escolha.nome, pend.tx_tipo).catch(() => {})
    }
    return { ok: true, reply: `✔️ Movido para *${escolha.nome}*. Vou lembrar disso na próxima! 🧠` }
  } catch (e) {
    log.warn('[wa-categoria-outros] update error', e?.message)
    return { ok: false, reply: '❌ Não consegui recategorizar. Tente pelo app.' }
  }
}
