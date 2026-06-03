import { getSupabaseAdmin } from './supabase-admin.mjs'
import { isMissingColumnError } from './assinatura-db.mjs'
import { criarAgendaEvento, atualizarAgendaEvento, deletarAgendaEvento } from './domain/agenda.mjs'
import { log } from './logger.mjs'

const LIST_SELECT_COLS = 'id, usuario_id, nome, tipo, categoria_financeira, orcamento, recorrencia, proxima_geracao, arquivada_em, criada_em'
const ITEM_BASE_COLS = 'id, lista_id, nome, quantidade, unidade, preco_estimado, categoria_item, checked, checked_em, criado_em, prazo, agenda_evento_id, checked_por'

// Coluna `unidades` foi adicionada via migration 50_shopping_list_items_unidades.sql.
// Mantemos fallback gracioso caso o schema ainda não tenha sido migrado: a primeira
// chamada que falhar com 42703 desliga o flag e reusa o select sem `unidades`.
let hasUnidadesColumn = true
const itemSelectCols = () => (hasUnidadesColumn ? `${ITEM_BASE_COLS}, unidades` : ITEM_BASE_COLS)
const listaWithItensSelect = () =>
  `${LIST_SELECT_COLS}, itens:shopping_list_items(${itemSelectCols()})`

function stripUnidadesIfMissing(payload) {
  if (hasUnidadesColumn) return payload
  if (payload && typeof payload === 'object' && 'unidades' in payload) {
    const { unidades: _omit, ...rest } = payload
    return rest
  }
  return payload
}

/**
 * Executa um builder do Supabase. Se ele falhar com erro de coluna `unidades`
 * inexistente, marca a flag e tenta de novo (o caller refaz o builder sem
 * referenciar a coluna).
 * @template T
 * @param {() => Promise<{ data: T, error: any }>} run
 * @returns {Promise<{ data: T, error: any }>}
 */
async function runWithUnidadesFallback(run) {
  const res = await run()
  if (res.error && hasUnidadesColumn && isMissingColumnError(res.error, 'unidades')) {
    hasUnidadesColumn = false
    return await run()
  }
  return res
}

const RECORRENCIAS_VALIDAS = new Set(['nenhuma', 'semanal', 'mensal'])

/**
 * Próxima data de regeneração a partir de uma base. Null para 'nenhuma'.
 * @param {string} recorrencia
 * @param {Date} [fromDate]
 * @returns {string|null}
 */
function calcularProximaGeracao(recorrencia, fromDate = new Date()) {
  const base = new Date(fromDate)
  if (recorrencia === 'semanal') { base.setDate(base.getDate() + 7); return base.toISOString() }
  if (recorrencia === 'mensal') { base.setMonth(base.getMonth() + 1); return base.toISOString() }
  return null
}

/**
 * Geração lazy (#11): listas recorrentes vencidas "renascem" — todos os itens
 * voltam a ficar desmarcados e a próxima geração avança até o futuro.
 * Roda ao listar as listas do usuário (sem cron externo). Best-effort.
 * @param {string} usuarioId
 */
async function processarListasRecorrentes(usuarioId) {
  try {
    const supabase = getSupabaseAdmin()
    const nowIso = new Date().toISOString()
    const { data: devidas } = await supabase
      .from('shopping_lists')
      .select('id, recorrencia, proxima_geracao')
      .eq('usuario_id', usuarioId)
      .neq('recorrencia', 'nenhuma')
      .not('proxima_geracao', 'is', null)
      .lte('proxima_geracao', nowIso)
      .is('arquivada_em', null)
    if (!devidas?.length) return

    const now = new Date()
    for (const l of devidas) {
      try {
        await supabase
          .from('shopping_list_items')
          .update({ checked: false, checked_em: null, checked_por: null })
          .eq('lista_id', l.id)
          .eq('checked', true)
        // Avança a partir do vencimento até ficar no futuro (não acumula ciclos perdidos)
        let prox = new Date(l.proxima_geracao)
        do { prox = new Date(calcularProximaGeracao(l.recorrencia, prox)) } while (prox <= now)
        await supabase.from('shopping_lists').update({ proxima_geracao: prox.toISOString() }).eq('id', l.id)
      } catch (e) {
        log.warn('[lista-compras] falha ao regenerar lista recorrente', e)
      }
    }
  } catch (e) {
    log.warn('[lista-compras] falha ao processar listas recorrentes', e)
  }
}

/**
 * Anexa `checked_por_nome` (primeiro nome de quem marcou) a uma lista de itens.
 * Muta os objetos in place. #12 — família colaborativa.
 * @param {Array} items
 * @returns {Promise<Array>}
 */
async function anexarNomesChecked(items) {
  const lista = Array.isArray(items) ? items : []
  const ids = [...new Set(lista.map((i) => i.checked_por).filter(Boolean))]
  if (!ids.length) return lista
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('usuarios').select('id, nome').in('id', ids)
  const mapa = new Map((data || []).map((u) => [u.id, String(u.nome || '').trim().split(/\s+/)[0] || null]))
  for (const it of lista) {
    it.checked_por_nome = it.checked_por ? (mapa.get(it.checked_por) || null) : null
  }
  return lista
}

/**
 * @param {string} usuarioId
 * @returns {Promise<Array>}
 */
export async function listarListasUsuario(usuarioId) {
  const supabase = getSupabaseAdmin()
  // #11 — regenera listas recorrentes vencidas antes de devolver
  await processarListasRecorrentes(usuarioId)
  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_lists')
      .select(listaWithItensSelect())
      .eq('usuario_id', usuarioId)
      .is('arquivada_em', null)
      .order('criada_em', { ascending: false })
  )

  if (error) throw new Error(error.message || 'Erro ao listar listas.')
  const listas = data || []
  await anexarNomesChecked(listas.flatMap((l) => (Array.isArray(l.itens) ? l.itens : [])))
  return listas
}

/**
 * Normaliza orçamento: null (sem teto) ou número > 0. Lança erro se inválido.
 * @param {unknown} valor
 * @returns {number|null}
 */
function normalizarOrcamento(valor) {
  if (valor === undefined || valor === null || valor === '') return null
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) throw new Error('Orçamento inválido (deve ser maior que zero).')
  return Math.round(n * 100) / 100
}

/**
 * Normaliza prazo: null (sem prazo) ou ISO. Lança erro se data inválida.
 * @param {unknown} valor
 * @returns {string|null}
 */
function normalizarPrazo(valor) {
  if (valor === undefined || valor === null || valor === '') return null
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) throw new Error('Prazo inválido.')
  return d.toISOString()
}

/**
 * Cria um evento na agenda para uma tarefa com prazo. Best-effort — devolve o id
 * do evento ou null (sem suporte/erro). Nunca lança: o item é salvo de qualquer forma.
 * @param {string} usuarioId
 * @param {{ nome: string, prazo: string, listaNome?: string }} dados
 * @returns {Promise<string|null>}
 */
async function criarEventoParaTarefa(usuarioId, { nome, prazo, listaNome }) {
  try {
    const titulo = String(nome || '').trim()
    if (titulo.length < 2 || !prazo) return null
    const ev = await criarAgendaEvento(usuarioId, {
      titulo,
      descricao: listaNome ? `Tarefa da lista "${listaNome}"` : 'Tarefa da lista',
      inicio: new Date(prazo).toISOString(),
      lembrar_minutos_antes: 0,
      whatsapp_notificar: true,
    })
    return ev?.id || null
  } catch (e) {
    log.warn('[lista-compras] falha ao criar evento de agenda da tarefa', e)
    return null
  }
}

/**
 * Sincroniza o evento de agenda de um item conforme seu prazo atual.
 * - sem prazo + tinha evento → apaga o evento
 * - com prazo + tinha evento → atualiza título/início (recria se o evento sumiu)
 * - com prazo + sem evento → cria
 * Best-effort: nunca lança. Muta `item.agenda_evento_id` para refletir o resultado.
 * @param {string} usuarioId
 * @param {{ id: string, nome: string, prazo: string|null, agenda_evento_id: string|null }} item
 * @param {string} listaNome
 * @param {ReturnType<typeof getSupabaseAdmin>} supabase
 */
async function sincronizarEventoItem(usuarioId, item, listaNome, supabase) {
  try {
    const prazoIso = item.prazo ? new Date(item.prazo).toISOString() : null
    const eventoId = item.agenda_evento_id || null
    const titulo = String(item.nome || '').trim()

    if (!prazoIso) {
      if (eventoId) {
        try { await deletarAgendaEvento(eventoId, usuarioId) } catch { /* já apagado */ }
        await supabase.from('shopping_list_items').update({ agenda_evento_id: null }).eq('id', item.id)
        item.agenda_evento_id = null
      }
      return
    }

    if (titulo.length < 2) return

    if (eventoId) {
      try {
        await atualizarAgendaEvento(eventoId, usuarioId, { titulo, inicio: prazoIso })
        return
      } catch {
        // evento sumiu — cria de novo abaixo
      }
    }
    const novoId = await criarEventoParaTarefa(usuarioId, { nome: titulo, prazo: prazoIso, listaNome })
    if (novoId) {
      await supabase.from('shopping_list_items').update({ agenda_evento_id: novoId }).eq('id', item.id)
      item.agenda_evento_id = novoId
    }
  } catch (e) {
    log.warn('[lista-compras] falha ao sincronizar evento de agenda do item', e)
  }
}

/**
 * @param {string} usuarioId
 * @param {{ nome: string, tipo?: 'compras'|'tarefas', categoria_financeira?: string, orcamento?: number|null }} campos
 * @returns {Promise<object>}
 */
export async function criarLista(usuarioId, { nome, tipo, categoria_financeira, orcamento }) {
  const nomeTrimmed = String(nome || '').trim()
  if (!nomeTrimmed || nomeTrimmed.length > 100) {
    throw new Error('Nome da lista inválido (1–100 caracteres).')
  }
  const tipoNorm = String(tipo || 'compras').trim().toLowerCase()
  const tipoFinal = tipoNorm === 'tarefas' ? 'tarefas' : 'compras'
  const orcamentoFinal = normalizarOrcamento(orcamento)

  const supabase = getSupabaseAdmin()
  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_lists')
      .insert({
        usuario_id: usuarioId,
        nome: nomeTrimmed,
        tipo: tipoFinal,
        categoria_financeira: String(categoria_financeira || 'Alimentação').trim(),
        orcamento: orcamentoFinal,
      })
      .select(listaWithItensSelect())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao criar lista.')
  return data
}

/**
 * @param {string} id
 * @param {string} usuarioId
 * @param {{ nome?: string, categoria_financeira?: string }} campos
 * @returns {Promise<object>}
 */
export async function atualizarLista(id, usuarioId, campos) {
  const update = {}

  if (campos.nome !== undefined) {
    const nomeTrimmed = String(campos.nome).trim()
    if (!nomeTrimmed || nomeTrimmed.length > 100) {
      throw new Error('Nome da lista inválido (1–100 caracteres).')
    }
    update.nome = nomeTrimmed
  }

  if (campos.categoria_financeira !== undefined) {
    update.categoria_financeira = String(campos.categoria_financeira).trim()
  }

  if (campos.orcamento !== undefined) {
    update.orcamento = normalizarOrcamento(campos.orcamento)
  }

  if (campos.recorrencia !== undefined) {
    const r = String(campos.recorrencia || 'nenhuma').trim().toLowerCase()
    if (!RECORRENCIAS_VALIDAS.has(r)) throw new Error('Recorrência inválida.')
    update.recorrencia = r
    update.proxima_geracao = r === 'nenhuma' ? null : calcularProximaGeracao(r)
  }

  if (Object.keys(update).length === 0) {
    throw new Error('Nenhum campo para atualizar.')
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_lists')
      .update(update)
      .eq('id', id)
      .eq('usuario_id', usuarioId)
      .is('arquivada_em', null)
      .select(listaWithItensSelect())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao atualizar lista.')
  if (!data) throw new Error('Lista não encontrada.')
  return data
}

/**
 * @param {string} id
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
export async function arquivarLista(id, usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('shopping_lists')
    .update({ arquivada_em: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .is('arquivada_em', null)
    .select('id')

  if (error) throw new Error(error.message || 'Erro ao arquivar lista.')
  if (!data?.length) throw new Error('Lista não encontrada.')
}

/**
 * Exclui permanentemente uma lista e todos os seus itens.
 * @param {string} id
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
export async function excluirLista(id, usuarioId) {
  const supabase = getSupabaseAdmin()
  // Verificar ownership antes de deletar
  const { data: lista, error: findErr } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (findErr) throw new Error(findErr.message || 'Erro ao localizar lista.')
  if (!lista) throw new Error('Lista não encontrada.')

  // Deletar itens primeiro (FK)
  const { error: itemErr } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('lista_id', id)
  if (itemErr) throw new Error(itemErr.message || 'Erro ao remover itens da lista.')

  // Deletar lista
  const { error } = await supabase
    .from('shopping_lists')
    .delete()
    .eq('id', id)
    .eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message || 'Erro ao excluir lista.')
}

/**
 * @param {string} listaId
 * @param {string} usuarioId
 * @returns {Promise<Array>}
 */
export async function listarItensLista(listaId, usuarioId) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_list_items')
      .select(itemSelectCols())
      .eq('lista_id', listaId)
      .order('criado_em', { ascending: true })
  )

  if (error) throw new Error(error.message || 'Erro ao listar itens.')
  return await anexarNomesChecked(data || [])
}

/**
 * @param {string} listaId
 * @param {string} usuarioId
 * @param {{ nome: string, quantidade?: number, unidade?: string, unidades?: number, preco_estimado?: number|null, categoria_item?: string|null }} campos
 * @returns {Promise<object>}
 */
export async function criarItem(listaId, usuarioId, { nome, quantidade, unidade, unidades, preco_estimado, categoria_item, prazo }) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership (e pegar nome p/ descrição do evento de agenda)
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id, nome')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  const prazoIso = normalizarPrazo(prazo)

  const nomeTrimmed = String(nome || '').trim()
  if (!nomeTrimmed || nomeTrimmed.length > 200) {
    throw new Error('Nome do item inválido (1–200 caracteres).')
  }

  const qty = quantidade !== undefined && quantidade !== null ? Number(quantidade) : 1
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }

  const unid = unidades !== undefined && unidades !== null ? Math.floor(Number(unidades)) : 1
  if (!Number.isFinite(unid) || unid < 1) {
    throw new Error('Unidades deve ser ao menos 1.')
  }

  const preco = preco_estimado !== undefined && preco_estimado !== null
    ? Number(preco_estimado)
    : null
  if (preco !== null && (!Number.isFinite(preco) || preco < 0)) {
    throw new Error('Preço estimado inválido.')
  }

  const insertPayload = {
    lista_id: listaId,
    nome: nomeTrimmed,
    quantidade: qty,
    unidade: String(unidade || 'un').trim().slice(0, 20) || 'un',
    unidades: unid,
    preco_estimado: preco,
    categoria_item: categoria_item ? String(categoria_item).trim() : null,
    prazo: prazoIso,
  }

  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_list_items')
      .insert(stripUnidadesIfMissing(insertPayload))
      .select(itemSelectCols())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao criar item.')

  // #10 — item com prazo cria lembrete na agenda
  if (data && prazoIso) {
    const eventoId = await criarEventoParaTarefa(usuarioId, { nome: nomeTrimmed, prazo: prazoIso, listaNome: lista.nome })
    if (eventoId) {
      await supabase.from('shopping_list_items').update({ agenda_evento_id: eventoId }).eq('id', data.id)
      data.agenda_evento_id = eventoId
    }
  }
  return data
}

/**
 * @param {string} id
 * @param {string} listaId
 * @param {string} usuarioId
 * @param {Record<string, unknown>} campos
 * @returns {Promise<object>}
 */
export async function atualizarItem(id, listaId, usuarioId, campos) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership via lista (e nome p/ descrição do evento)
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id, nome')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  const update = {}

  if (campos.nome !== undefined) {
    const nomeTrimmed = String(campos.nome).trim()
    if (!nomeTrimmed || nomeTrimmed.length > 200) throw new Error('Nome do item inválido (1–200 caracteres).')
    update.nome = nomeTrimmed
  }

  if (campos.prazo !== undefined) {
    update.prazo = normalizarPrazo(campos.prazo)
  }

  if (campos.quantidade !== undefined) {
    const qty = Number(campos.quantidade)
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantidade inválida.')
    update.quantidade = qty
  }

  if (campos.unidade !== undefined) {
    update.unidade = String(campos.unidade).trim().slice(0, 20) || 'un'
  }

  if (campos.unidades !== undefined) {
    const u = Math.floor(Number(campos.unidades))
    if (!Number.isFinite(u) || u < 1) throw new Error('Unidades deve ser ao menos 1.')
    update.unidades = u
  }

  if (campos.preco_estimado !== undefined) {
    const preco = campos.preco_estimado !== null ? Number(campos.preco_estimado) : null
    if (preco !== null && (!Number.isFinite(preco) || preco < 0)) throw new Error('Preço estimado inválido.')
    update.preco_estimado = preco
  }

  if (campos.categoria_item !== undefined) {
    update.categoria_item = campos.categoria_item ? String(campos.categoria_item).trim() : null
  }

  if (Object.keys(update).length === 0) throw new Error('Nenhum campo para atualizar.')

  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_list_items')
      .update(stripUnidadesIfMissing(update))
      .eq('id', id)
      .eq('lista_id', listaId)
      .select(itemSelectCols())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao atualizar item.')
  if (!data) throw new Error('Item não encontrado.')

  // #10 — manter o evento da agenda em sincronia quando prazo/nome mudam
  if (campos.prazo !== undefined || campos.nome !== undefined) {
    await sincronizarEventoItem(usuarioId, data, lista.nome, supabase)
  }
  return data
}

/**
 * Alterna checked/unchecked com checked_em e registra quem marcou (#12).
 * @param {string} id
 * @param {string} listaId
 * @param {string} usuarioId  dono dos dados (titular em conta família)
 * @param {string} [actorId]  quem efetivamente clicou (para checked_por)
 * @returns {Promise<object>}
 */
export async function toggleChecked(id, listaId, usuarioId, actorId = null) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  // Buscar estado atual
  const { data: item } = await supabase
    .from('shopping_list_items')
    .select('id, checked')
    .eq('id', id)
    .eq('lista_id', listaId)
    .maybeSingle()
  if (!item) throw new Error('Item não encontrado.')

  const novoChecked = !item.checked
  const { data, error } = await runWithUnidadesFallback(() =>
    supabase
      .from('shopping_list_items')
      .update({
        checked: novoChecked,
        checked_em: novoChecked ? new Date().toISOString() : null,
        checked_por: novoChecked ? (actorId || usuarioId) : null,
      })
      .eq('id', id)
      .eq('lista_id', listaId)
      .select(itemSelectCols())
      .maybeSingle()
  )

  if (error) throw new Error(error.message || 'Erro ao atualizar item.')
  return data
}

/**
 * @param {string} id
 * @param {string} listaId
 * @param {string} usuarioId
 * @returns {Promise<void>}
 */
export async function removerItem(id, listaId, usuarioId) {
  const supabase = getSupabaseAdmin()

  // Verificar ownership
  const { data: lista } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('id', listaId)
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (!lista) throw new Error('Lista não encontrada.')

  // Se o item tinha um lembrete na agenda, apaga junto (#10)
  const { data: existente } = await supabase
    .from('shopping_list_items')
    .select('agenda_evento_id')
    .eq('id', id)
    .eq('lista_id', listaId)
    .maybeSingle()
  if (existente?.agenda_evento_id) {
    try { await deletarAgendaEvento(existente.agenda_evento_id, usuarioId) } catch { /* já apagado */ }
  }

  const { data, error } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('id', id)
    .eq('lista_id', listaId)
    .select('id')

  if (error) throw new Error(error.message || 'Erro ao remover item.')
  if (!data?.length) throw new Error('Item não encontrado.')
}

/**
 * Nomes históricos de itens do usuário, ordenados por frequência — para autocomplete.
 * @param {string} usuarioId
 * @param {number} [limit=30]
 * @returns {Promise<string[]>}
 */
export async function listarHistoricoNomes(usuarioId, limit = 30) {
  const supabase = getSupabaseAdmin()

  // Buscar itens de todas as listas do usuário
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select(`nome, shopping_lists!inner(usuario_id)`)
    .eq('shopping_lists.usuario_id', usuarioId)
    .order('nome', { ascending: true })

  if (error) throw new Error(error.message || 'Erro ao buscar histórico.')

  // Contar frequência por nome (case-insensitive) e retornar os mais frequentes
  const freq = {}
  for (const row of data || []) {
    const nome = row.nome
    const key = nome.toLowerCase()
    if (!freq[key]) freq[key] = { nome, count: 0 }
    freq[key].count++
  }

  return Object.values(freq)
    .sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limit)
    .map((e) => e.nome)
}

/**
 * Mapa nome→último preço estimado conhecido, para sugerir preço ao digitar.
 * Considera o item mais recente (por criado_em) de cada nome que tenha preço > 0.
 * @param {string} usuarioId
 * @returns {Promise<Record<string, { nome: string, preco: number }>>}
 */
export async function listarHistoricoPrecos(usuarioId) {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('shopping_list_items')
    .select(`nome, preco_estimado, criado_em, shopping_lists!inner(usuario_id)`)
    .eq('shopping_lists.usuario_id', usuarioId)
    .not('preco_estimado', 'is', null)
    .gt('preco_estimado', 0)
    .order('criado_em', { ascending: false })

  if (error) throw new Error(error.message || 'Erro ao buscar histórico de preços.')

  // Primeiro registro por nome (ordenado desc) = mais recente.
  const mapa = {}
  for (const row of data || []) {
    const key = String(row.nome || '').toLowerCase().trim()
    if (!key || mapa[key]) continue
    mapa[key] = { nome: row.nome, preco: Number(row.preco_estimado) }
  }
  return mapa
}

/**
 * @param {string} usuarioId
 * @returns {Promise<Array>}
 */
export async function listarListasArquivadas(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(LIST_SELECT_COLS)
    .eq('usuario_id', usuarioId)
    .not('arquivada_em', 'is', null)
    .order('arquivada_em', { ascending: false })

  if (error) throw new Error(error.message || 'Erro ao listar arquivadas.')
  return data || []
}
