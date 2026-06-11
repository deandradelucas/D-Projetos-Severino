import { log } from '../logger.mjs'
import { parseListaComprasMessage } from '../ai-lista-compras.mjs'
import {
  listarListasUsuario,
  criarLista,
  criarItem,
  listarItensLista,
  toggleChecked,
  removerItem,
} from '../lista-compras.mjs'
import { setPendente, getPendente, clearPendente } from './wa-pendente.mjs'

// ---------------------------------------------------------------------------
// Detecção rápida (sem IA) — garante que só mensagens de lista de compras
// chegam ao parser Gemini.
//
// Construído com RegExp + array de padrões: regex literal multi-linha com
// flag /x (free-spacing) NÃO existe em JavaScript — só em Perl/Ruby/.NET.
// ---------------------------------------------------------------------------
const LISTA_PATTERNS = [
  // verbo + item(ns) + "na lista" (item pode cruzar linhas — flag dotAll abaixo)
  'adiciona[r]?\\s+.{1,200}\\s+na\\s+lista',
  'coloca[r]?\\s+.{1,200}\\s+na\\s+lista',
  'inclui[r]?\\s+.{1,200}\\s+na\\s+lista',
  'bota[r]?\\s+.{1,200}\\s+na\\s+lista',
  'p[oõ]e\\s+.{1,200}\\s+na\\s+lista',
  // verbo + "na lista" direto (itens vêm depois, ex: "adiciona na lista Mercado: arroz...")
  '(adiciona[r]?|coloca[r]?|inclui[r]?|bota[r]?|p[oõ]e)\\s+na\\s+lista',
  // menção a "na lista <nome>" (cobre formatos com dois pontos / linhas separadas)
  'na\\s+lista\\s+\\w',
  'cria[r]?\\s+(a\\s+|uma\\s+)?lista(\\s+chamada|\\s+de|\\s+para)?',
  'nova\\s+lista',
  'lista\\s+de\\s+compras',
  'minha[s]?\\s+lista[s]?',
  'ver\\s+(a\\s+|minha\\s+)?lista',
  'o\\s+que\\s+(tem|est[aá])\\s+na\\s+lista',
  'remove[r]?\\s+.{1,80}\\s+da\\s+lista',
  'tira[r]?\\s+.{1,80}\\s+da\\s+lista',
  'apaga[r]?\\s+.{1,80}\\s+da\\s+lista',
  // marcar como comprado/concluído — exige contexto de lista ("da lista" ou
  // verbo "riscar") para não sequestrar transações ("comprei 50 de arroz")
  'risca[r]?\\s+.{1,80}\\s+(da\\s+|na\\s+)?lista',
  'comprei\\s+.{1,80}\\s+da\\s+lista',
  'conclu[ií]\\s+.{1,80}\\s+da\\s+lista',
  'marca[r]?\\s+.{1,120}\\s+como\\s+(comprad|conclu[ií]d|feit)',
  // criação de lista de tarefas
  'lista\\s+de\\s+tarefas',
  'lista\\s+de\\s+afazeres',
]
// flag 's' (dotAll): permite que o `.` cruze quebras de linha em mensagens
// com itens listados um por linha.
const LISTA_RE = new RegExp(`\\b(${LISTA_PATTERNS.join('|')})`, 'is')

export function isListaComprasMessage(message) {
  return LISTA_RE.test(String(message || ''))
}

// ---------------------------------------------------------------------------
// Fuzzy match de nome de lista: normaliza acentos + lowercase + trim
// ---------------------------------------------------------------------------
function normalizeNome(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Match de nome de lista: exato resolve direto; senão devolve TODAS as
 * candidatas fuzzy (contém / contido) — quando há mais de uma, o chamador
 * pergunta ao usuário em vez de adivinhar (T2: desambiguação seletiva).
 */
function encontrarListasCandidatas(listas, nomeBuscado) {
  if (!nomeBuscado) return { exata: null, candidatas: [] }
  const alvo = normalizeNome(nomeBuscado)
  const exata = listas.find((l) => normalizeNome(l.nome) === alvo) || null
  if (exata) return { exata, candidatas: [exata] }
  const candidatas = listas.filter((l) => {
    const n = normalizeNome(l.nome)
    return n.includes(alvo) || alvo.includes(n)
  })
  return { exata: null, candidatas }
}

function encontrarListaPorNome(listas, nomeBuscado) {
  const { exata, candidatas } = encontrarListasCandidatas(listas, nomeBuscado)
  return exata || candidatas[0] || null
}

// ---------------------------------------------------------------------------
// Última lista "usada": a que recebeu o item mais recente (ou, se vazia, a
// criada mais recentemente). Usada como destino padrão quando o usuário não
// nomeia a lista. `listarListasUsuario` já traz os itens embarcados.
// ---------------------------------------------------------------------------
function tsLista(lista) {
  let ts = lista.criada_em ? Date.parse(lista.criada_em) : 0
  const itens = Array.isArray(lista.itens) ? lista.itens : []
  for (const it of itens) {
    const t = it.criado_em ? Date.parse(it.criado_em) : 0
    if (t > ts) ts = t
  }
  return Number.isFinite(ts) ? ts : 0
}

function encontrarUltimaListaUsada(listas) {
  if (!Array.isArray(listas) || listas.length === 0) return null
  return listas.reduce((melhor, atual) =>
    !melhor || tsLista(atual) > tsLista(melhor) ? atual : melhor, null)
}

// ---------------------------------------------------------------------------
// Formatação de resposta
// ---------------------------------------------------------------------------
function fmtItem(item) {
  const qty = Number(item.quantidade)
  const un = item.unidade || 'un'
  const qtyStr = qty === 1 && un === 'un' ? '' : ` — ${qty}${un}`
  return `• ${item.nome}${qtyStr}`
}

function fmtItemAdicionado(item) {
  const qty = Number(item.quantidade)
  const un = item.unidade || 'un'
  if (qty === 1 && un === 'un') return item.nome
  return `${qty}${un} de ${item.nome}`
}

// ---------------------------------------------------------------------------
// Adiciona uma lista de itens a uma lista existente. Best-effort: itens que
// falharem entram em `erros` sem abortar os demais.
// @returns {Promise<{ adicionados: Array, erros: string[] }>}
// ---------------------------------------------------------------------------
async function adicionarItensNaLista(listaId, usuarioId, itens) {
  const adicionados = []
  const erros = []
  for (const item of itens) {
    try {
      await criarItem(listaId, usuarioId, {
        nome: item.nome,
        quantidade: item.quantidade,
        unidade: item.unidade,
      })
      adicionados.push(item)
    } catch (e) {
      log.warn('[lista-compras-wa] criarItem error', { item: item.nome, err: String(e?.message || e).slice(0, 120) })
      erros.push(item.nome)
    }
  }
  return { adicionados, erros }
}

// ---------------------------------------------------------------------------
// Executores por intent (lista já resolvida) — usados pelo handler principal
// e pela resposta a pergunta pendente de desambiguação.
// ---------------------------------------------------------------------------
async function executarAdicionarItens(lista, usuarioId, itens, notaPadrao = '') {
  const { adicionados, erros } = await adicionarItensNaLista(lista.id, usuarioId, itens)
  if (adicionados.length === 0) {
    return { ok: false, reply: '❌ Não consegui adicionar os itens. Tente novamente.' }
  }
  const linhaItens = adicionados.map(fmtItemAdicionado).join(', ')
  const sufixoErro = erros.length > 0 ? `\n⚠️ Não adicionei: ${erros.join(', ')}` : ''
  return {
    ok: true,
    reply: `✅ *Adicionado à lista "${lista.nome}":*\n\n${linhaItens}${sufixoErro}${notaPadrao}`,
  }
}

async function executarRemoverOuMarcar(lista, usuarioId, itens, marcar) {
  let itensLista
  try {
    itensLista = await listarItensLista(lista.id, usuarioId)
  } catch (e) {
    log.error('[lista-compras-wa] listarItensLista error', e)
    return { ok: false, reply: '❌ Erro ao buscar itens da lista.' }
  }

  // Ao marcar, só consideramos pendentes; ao remover, qualquer item.
  const candidatos = marcar ? itensLista.filter((i) => !i.checked) : itensLista
  const feitos = []
  const naoEncontrados = []
  for (const alvo of itens) {
    const alvoNorm = normalizeNome(alvo.nome)
    const item =
      candidatos.find((i) => normalizeNome(i.nome) === alvoNorm) ||
      candidatos.find((i) => normalizeNome(i.nome).includes(alvoNorm)) ||
      candidatos.find((i) => alvoNorm.includes(normalizeNome(i.nome)))
    if (!item) {
      naoEncontrados.push(alvo.nome)
      continue
    }
    try {
      if (marcar) await toggleChecked(item.id, lista.id, usuarioId)
      else await removerItem(item.id, lista.id, usuarioId)
      feitos.push(item.nome)
      // evita marcar/remover o mesmo item duas vezes na mesma mensagem
      const idx = candidatos.indexOf(item)
      if (idx >= 0) candidatos.splice(idx, 1)
    } catch (e) {
      log.warn('[lista-compras-wa] acao item error', { item: item.nome, err: String(e?.message || e).slice(0, 120) })
      naoEncontrados.push(alvo.nome)
    }
  }

  if (feitos.length === 0) {
    const nomes = itens.map((i) => `"${i.nome}"`).join(', ')
    return { ok: true, reply: `🛒 Não encontrei ${nomes} na lista "${lista.nome}".` }
  }

  const acao = marcar ? '✅ *Marcado como comprado:*' : '🗑️ *Removido da lista:*'
  const sufixo = naoEncontrados.length > 0 ? `\n⚠️ Não encontrei: ${naoEncontrados.join(', ')}` : ''
  const pendentes = candidatos.filter((i) => !i.checked).length
  const rodape = marcar ? `\n\n${pendentes} item(ns) pendente(s) na "${lista.nome}"` : ''
  return {
    ok: true,
    reply: `${acao}\n\n${feitos.map((n) => `• ${n}`).join('\n')}${sufixo}${rodape}`,
  }
}

// ---------------------------------------------------------------------------
// Resposta a pergunta pendente de desambiguação ("qual lista? 1 ou 2").
// Retorna null quando não há pendência ou a mensagem não é um dígito —
// o fluxo normal do bot segue. Chamar ANTES dos menus numéricos da agenda.
// ---------------------------------------------------------------------------
export async function responderPendenteLista(usuarioId, phone, message) {
  const msg = String(message || '').trim()
  if (!/^[1-9]$/.test(msg)) return null
  let pend
  try {
    pend = await getPendente(phone)
  } catch {
    return null
  }
  if (!pend || pend.tipo !== 'lista_escolha') return null

  const idx = Number.parseInt(msg, 10) - 1
  const escolha = pend.candidatas?.[idx]
  if (!escolha) {
    return { ok: true, reply: `Responda um número de *1* a *${pend.candidatas?.length || 1}*.` }
  }
  await clearPendente(phone).catch(() => {})

  let listas
  try {
    listas = await listarListasUsuario(usuarioId)
  } catch (e) {
    log.error('[lista-compras-wa] listarListasUsuario error', e)
    return { ok: false, reply: '❌ Erro ao acessar suas listas. Tente novamente.' }
  }
  const lista = listas.find((l) => l.id === escolha.id)
  if (!lista) return { ok: true, reply: '🛒 Essa lista não existe mais.' }

  if (pend.intent === 'ADICIONAR_ITENS') return executarAdicionarItens(lista, usuarioId, pend.itens)
  return executarRemoverOuMarcar(lista, usuarioId, pend.itens, pend.intent === 'MARCAR_COMPRADO')
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
/**
 * @param {string} usuarioId  — dataUsuarioId da conta (respeitando família)
 * @param {string} message
 * @param {string} [phone]    — habilita pergunta de desambiguação (estado pendente)
 * @returns {Promise<{ ok: boolean, reply: string }>}
 */
export async function processarMensagemListaCompras(usuarioId, message, phone = null) {
  let parsed
  try {
    parsed = await parseListaComprasMessage(message)
  } catch (e) {
    log.warn('[lista-compras-wa] parseListaComprasMessage error', String(e?.message || e).slice(0, 200))
    return { ok: false, reply: '⚠️ Não consegui interpretar sua mensagem de lista de compras. Tente novamente.' }
  }

  const { intent, lista_nome, tipo_lista, itens } = parsed

  // CHAT — não é sobre lista de compras (falso positivo do regex)
  if (intent === 'CHAT') return null

  // Carregar listas do usuário
  let listas
  try {
    listas = await listarListasUsuario(usuarioId)
  } catch (e) {
    log.error('[lista-compras-wa] listarListasUsuario error', e)
    return { ok: false, reply: '❌ Erro ao acessar suas listas. Tente novamente.' }
  }

  // ---------------------------------------------------------------------------
  // CRIAR_LISTA
  // ---------------------------------------------------------------------------
  if (intent === 'CRIAR_LISTA') {
    const nome = lista_nome || 'Minha lista'
    const tipo = tipo_lista === 'tarefas' ? 'tarefas' : 'compras'
    let novaLista
    try {
      novaLista = await criarLista(usuarioId, { nome, tipo, categoria_financeira: 'Alimentação' })
    } catch (e) {
      log.error('[lista-compras-wa] criarLista error', e)
      return { ok: false, reply: `❌ Não consegui criar a lista. ${e.message || ''}` }
    }

    // Sem itens iniciais → só confirma a criação
    if (!itens || itens.length === 0) {
      return {
        ok: true,
        reply:
          `✅ *Lista "${nome}" criada!*\n\n` +
          `Agora adicione itens com:\n"adiciona 2kg de arroz na lista ${nome}"`,
      }
    }

    // Cria a lista JÁ com os itens citados na mesma mensagem
    const { adicionados, erros } = await adicionarItensNaLista(novaLista.id, usuarioId, itens)
    const sufixoErro = erros.length > 0 ? `\n⚠️ Não adicionei: ${erros.join(', ')}` : ''
    if (adicionados.length === 0) {
      return {
        ok: true,
        reply:
          `✅ *Lista "${nome}" criada!*${sufixoErro}\n\n` +
          `Adicione itens com:\n"adiciona 2kg de arroz na lista ${nome}"`,
      }
    }
    const linhaItens = adicionados.map(fmtItemAdicionado).join(', ')
    return {
      ok: true,
      reply:
        `✅ *Lista "${nome}" criada com:*\n\n${linhaItens}${sufixoErro}`,
    }
  }

  // ---------------------------------------------------------------------------
  // VER_LISTA
  // ---------------------------------------------------------------------------
  if (intent === 'VER_LISTA') {
    const lista = encontrarListaPorNome(listas, lista_nome)
    if (!lista) {
      const nomes = listas.map((l) => `"${l.nome}"`).join(', ')
      return {
        ok: true,
        reply: nomes
          ? `🛒 Lista "${lista_nome}" não encontrada.\n\nSuas listas: ${nomes}`
          : `🛒 Você ainda não tem listas de compras.\n\nCrie com: "cria uma lista chamada Mercado"`,
      }
    }

    let itensLista
    try {
      itensLista = await listarItensLista(lista.id, usuarioId)
    } catch (e) {
      log.error('[lista-compras-wa] listarItensLista error', e)
      return { ok: false, reply: '❌ Erro ao buscar itens da lista.' }
    }

    const pendentes = itensLista.filter((i) => !i.checked)
    const comprados = itensLista.filter((i) => i.checked)

    if (itensLista.length === 0) {
      return {
        ok: true,
        reply: `🛒 *Lista "${lista.nome}"* está vazia.\n\nAdicione itens com:\n"adiciona leite na lista ${lista.nome}"`,
      }
    }

    const linhasPendentes = pendentes.map(fmtItem).join('\n')
    const rodape =
      comprados.length > 0
        ? `\n\n✅ ${comprados.length} item(ns) já comprado(s)`
        : ''

    return {
      ok: true,
      reply:
        `🛒 *Lista "${lista.nome}"* — ${pendentes.length} pendente(s)\n\n` +
        linhasPendentes +
        rodape,
    }
  }

  // ---------------------------------------------------------------------------
  // ADICIONAR_ITENS
  // ---------------------------------------------------------------------------
  if (intent === 'ADICIONAR_ITENS') {
    if (!itens || itens.length === 0) {
      return {
        ok: false,
        reply: '⚠️ Não identifiquei nenhum item para adicionar. Tente: "adiciona 2kg de arroz na lista Mercado"',
      }
    }

    if (listas.length === 0) {
      return {
        ok: true,
        reply:
          `🛒 Você ainda não tem listas.\n\nCrie uma primeiro:\n"cria uma lista chamada Mercado"`,
      }
    }

    // Encontrar lista pelo nome citado — exato resolve; fuzzy com 2+ matches PERGUNTA
    const { exata, candidatas } = encontrarListasCandidatas(listas, lista_nome)
    let lista = exata || (candidatas.length === 1 ? candidatas[0] : null)

    if (!lista && candidatas.length > 1 && phone) {
      const ops = candidatas.slice(0, 4)
      await setPendente(phone, {
        tipo: 'lista_escolha',
        intent,
        itens,
        candidatas: ops.map((l) => ({ id: l.id, nome: l.nome })),
      }).catch(() => {})
      return {
        ok: true,
        reply:
          `🛒 Encontrei ${ops.length} listas parecidas com "${lista_nome}". Em qual?\n\n` +
          ops.map((l, i) => `*${i + 1}* – ${l.nome}`).join('\n'),
      }
    }
    if (!lista && candidatas.length > 1) lista = candidatas[0]

    // Sem nome citado → usa a última lista usada como destino padrão (#2)
    let usouPadrao = false
    if (!lista && !lista_nome) {
      lista = encontrarUltimaListaUsada(listas)
      usouPadrao = listas.length > 1
    }

    // Nome citado mas não encontrado → listar opções (não adivinhar)
    if (!lista) {
      const nomes = listas.map((l) => `"${l.nome}"`).join(', ')
      const mencaoLista = lista_nome ? `"${lista_nome}" ` : ''
      return {
        ok: true,
        reply:
          `🛒 Lista ${mencaoLista}não encontrada.\n\nSuas listas: ${nomes}\n\nUse o nome exato, ex:\n"adiciona arroz na lista ${listas[0].nome}"`,
      }
    }

    // Avisa qual lista foi usada quando o destino foi inferido entre várias
    const notaPadrao = usouPadrao ? `\n\n_Adicionei à sua lista mais recente. Para outra, diga "...na lista <nome>"._` : ''
    return executarAdicionarItens(lista, usuarioId, itens, notaPadrao)
  }

  // ---------------------------------------------------------------------------
  // REMOVER_ITENS / MARCAR_COMPRADO — resolve a lista, casa cada item citado
  // com os itens existentes (fuzzy: exato → contém) e aplica a ação.
  // ---------------------------------------------------------------------------
  if (intent === 'REMOVER_ITENS' || intent === 'MARCAR_COMPRADO') {
    const marcar = intent === 'MARCAR_COMPRADO'
    if (!itens || itens.length === 0) {
      return {
        ok: false,
        reply: marcar
          ? '⚠️ Não identifiquei qual item marcar. Tente: "comprei o arroz da lista Mercado"'
          : '⚠️ Não identifiquei qual item remover. Tente: "tira o leite da lista Mercado"',
      }
    }

    if (listas.length === 0) {
      return { ok: true, reply: '🛒 Você ainda não tem listas.' }
    }

    const { exata, candidatas } = encontrarListasCandidatas(listas, lista_nome)
    let lista = exata || (candidatas.length === 1 ? candidatas[0] : null)
    if (!lista && candidatas.length > 1 && phone) {
      const ops = candidatas.slice(0, 4)
      await setPendente(phone, {
        tipo: 'lista_escolha',
        intent,
        itens,
        candidatas: ops.map((l) => ({ id: l.id, nome: l.nome })),
      }).catch(() => {})
      return {
        ok: true,
        reply:
          `🛒 Encontrei ${ops.length} listas parecidas com "${lista_nome}". Em qual?\n\n` +
          ops.map((l, i) => `*${i + 1}* – ${l.nome}`).join('\n'),
      }
    }
    if (!lista && candidatas.length > 1) lista = candidatas[0]
    if (!lista && !lista_nome) lista = encontrarUltimaListaUsada(listas)
    if (!lista) {
      const nomes = listas.map((l) => `"${l.nome}"`).join(', ')
      return {
        ok: true,
        reply: `🛒 Lista "${lista_nome}" não encontrada.\n\nSuas listas: ${nomes}`,
      }
    }

    return executarRemoverOuMarcar(lista, usuarioId, itens, marcar)
  }

  // Fallback
  return null
}
