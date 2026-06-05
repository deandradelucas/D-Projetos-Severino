import { log } from '../logger.mjs'
import { parseListaComprasMessage } from '../ai-lista-compras.mjs'
import {
  listarListasUsuario,
  criarLista,
  criarItem,
  listarItensLista,
} from '../lista-compras.mjs'

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

function encontrarListaPorNome(listas, nomeBuscado) {
  if (!nomeBuscado) return null
  const alvo = normalizeNome(nomeBuscado)
  // Match exato
  const exato = listas.find((l) => normalizeNome(l.nome) === alvo)
  if (exato) return exato
  // Match parcial: nome da lista contém o termo buscado
  const parcial = listas.find((l) => normalizeNome(l.nome).includes(alvo))
  if (parcial) return parcial
  // Match parcial inverso: termo buscado contém o nome da lista
  const inverso = listas.find((l) => alvo.includes(normalizeNome(l.nome)))
  if (inverso) return inverso
  return null
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
// Handler principal
// ---------------------------------------------------------------------------
/**
 * @param {string} usuarioId  — dataUsuarioId da conta (respeitando família)
 * @param {string} message
 * @returns {Promise<{ ok: boolean, reply: string }>}
 */
export async function processarMensagemListaCompras(usuarioId, message) {
  let parsed
  try {
    parsed = await parseListaComprasMessage(message)
  } catch (e) {
    log.warn('[lista-compras-wa] parseListaComprasMessage error', String(e?.message || e).slice(0, 200))
    return { ok: false, reply: '⚠️ Não consegui interpretar sua mensagem de lista de compras. Tente novamente.' }
  }

  const { intent, lista_nome, itens } = parsed

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
    let novaLista
    try {
      novaLista = await criarLista(usuarioId, { nome, categoria_financeira: 'Alimentação' })
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

    // Encontrar lista pelo nome citado
    let lista = encontrarListaPorNome(listas, lista_nome)

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

    // Adicionar itens
    const { adicionados, erros } = await adicionarItensNaLista(lista.id, usuarioId, itens)

    if (adicionados.length === 0) {
      return { ok: false, reply: '❌ Não consegui adicionar os itens. Tente novamente.' }
    }

    const linhaItens = adicionados.map(fmtItemAdicionado).join(', ')
    const sufixoErro = erros.length > 0 ? `\n⚠️ Não adicionei: ${erros.join(', ')}` : ''
    // Avisa qual lista foi usada quando o destino foi inferido entre várias
    const notaPadrao = usouPadrao ? `\n\n_Adicionei à sua lista mais recente. Para outra, diga "...na lista <nome>"._` : ''

    return {
      ok: true,
      reply:
        `✅ *Adicionado à lista "${lista.nome}":*\n\n${linhaItens}${sufixoErro}${notaPadrao}`,
    }
  }

  // Fallback
  return null
}
