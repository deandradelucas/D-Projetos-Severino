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
  'adiciona[r]?\\s+.{1,120}\\s+na\\s+lista',
  'coloca[r]?\\s+.{1,120}\\s+na\\s+lista',
  'inclui[r]?\\s+.{1,120}\\s+na\\s+lista',
  'bota[r]?\\s+.{1,120}\\s+na\\s+lista',
  'p[oõ]e\\s+.{1,120}\\s+na\\s+lista',
  'cria[r]?\\s+(uma\\s+)?lista(\\s+chamada|\\s+de|\\s+para)?',
  'nova\\s+lista',
  'lista\\s+de\\s+compras',
  'minha[s]?\\s+lista[s]?',
  'ver\\s+(a\\s+|minha\\s+)?lista',
  'o\\s+que\\s+(tem|est[aá])\\s+na\\s+lista',
  'remove[r]?\\s+.{1,80}\\s+da\\s+lista',
  'tira[r]?\\s+.{1,80}\\s+da\\s+lista',
  'apaga[r]?\\s+.{1,80}\\s+da\\s+lista',
]
const LISTA_RE = new RegExp(`\\b(${LISTA_PATTERNS.join('|')})\\b`, 'i')

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
    try {
      await criarLista(usuarioId, { nome, categoria_financeira: 'Alimentação' })
      return {
        ok: true,
        reply:
          `✅ *Lista "${nome}" criada!*\n\n` +
          `Agora adicione itens com:\n"adiciona 2kg de arroz na lista ${nome}"`,
      }
    } catch (e) {
      log.error('[lista-compras-wa] criarLista error', e)
      return { ok: false, reply: `❌ Não consegui criar a lista. ${e.message || ''}` }
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

    // Encontrar lista
    let lista = encontrarListaPorNome(listas, lista_nome)

    // Lista não encontrada → listar opções
    if (!lista) {
      if (listas.length === 0) {
        return {
          ok: true,
          reply:
            `🛒 Você ainda não tem listas.\n\nCrie uma primeiro:\n"cria uma lista chamada Mercado"`,
        }
      }
      const nomes = listas.map((l) => `"${l.nome}"`).join(', ')
      const mencaoLista = lista_nome ? `"${lista_nome}" ` : ''
      return {
        ok: true,
        reply:
          `🛒 Lista ${mencaoLista}não encontrada.\n\nSuas listas: ${nomes}\n\nUse o nome exato, ex:\n"adiciona arroz na lista ${listas[0].nome}"`,
      }
    }

    // Adicionar itens
    const adicionados = []
    const erros = []

    for (const item of itens) {
      try {
        await criarItem(lista.id, usuarioId, {
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

    if (adicionados.length === 0) {
      return { ok: false, reply: '❌ Não consegui adicionar os itens. Tente novamente.' }
    }

    const linhaItens = adicionados.map(fmtItemAdicionado).join(', ')
    const sufixoErro = erros.length > 0 ? `\n⚠️ Não adicionei: ${erros.join(', ')}` : ''

    return {
      ok: true,
      reply:
        `✅ *Adicionado à lista "${lista.nome}":*\n\n${linhaItens}${sufixoErro}`,
    }
  }

  // Fallback
  return null
}
