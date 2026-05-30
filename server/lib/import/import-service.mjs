import { createHash } from 'crypto'
import { log } from '../logger.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { getCategorias, inserirTransacao } from '../transacoes.mjs'
import { suggestCategoryForTransaction } from '../ai-category.mjs'

const BATCH_SIZE = 10

function buildHashes(usuarioId, rows) {
  const counter = new Map()
  return rows.map((row) => {
    if (row.fitid) {
      return createHash('sha256').update(`${usuarioId}:ofx:${row.fitid}`).digest('hex')
    }
    const base = `${usuarioId}:${row.data}:${String(row.descricao).toLowerCase().trim()}:${row.valor}`
    const n = counter.get(base) || 0
    counter.set(base, n + 1)
    const key = n === 0 ? base : `${base}:${n}`
    return createHash('sha256').update(key).digest('hex')
  })
}

async function fetchExistingHashes(supabase, usuarioId, hashes) {
  if (!hashes.length) return new Set()
  const { data, error } = await supabase
    .from('transacoes')
    .select('origem_hash')
    .eq('usuario_id', usuarioId)
    .in('origem_hash', hashes)
  if (error) {
    log.warn('[import] erro ao verificar duplicatas', { detail: String(error.message || error).slice(0, 200) })
    return new Set()
  }
  return new Set((data || []).map((r) => r.origem_hash).filter(Boolean))
}

async function categorizarBatch(rows, categorias) {
  const results = []
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const resolved = await Promise.all(
      chunk.map((row) => suggestCategoryForTransaction(row.descricao, row.tipo, categorias).catch(() => ({ categoria_id: null, subcategoria_id: null })))
    )
    results.push(...resolved)
  }
  return results
}

function resolveFallbackCategoria(categorias, tipo) {
  const outros = (categorias || []).find((c) => c.tipo === tipo && c.nome.toLowerCase() === 'outros')
  if (!outros) return { categoria_id: null, subcategoria_id: null }
  const sub = (outros.subcategorias || []).find((s) => s.nome.toLowerCase() === 'outros')
  return { categoria_id: outros.id, subcategoria_id: sub?.id ?? null }
}

/**
 * Importa um array de transações normalizadas para o banco do usuário.
 *
 * @param {string} usuarioId
 * @param {Array<{data, descricao, valor, tipo, fitid?}>} rows — saída dos parsers
 * @param {{ fontePlanilha?: string }} options
 * @returns {{ importadas, ignoradas, erros, despesas, receitas, semCategoria }}
 */
export async function importarTransacoes(usuarioId, rows, options = {}) {
  const uid = String(usuarioId || '').trim()
  if (!uid) throw new Error('usuarioId obrigatório')
  if (!Array.isArray(rows) || !rows.length) {
    return { importadas: 0, ignoradas: 0, erros: 0, despesas: 0, receitas: 0, semCategoria: 0 }
  }

  log.info('[import] iniciando', { usuarioId: uid, total: rows.length, fonte: options.fontePlanilha || 'desconhecido' })

  const supabase = getSupabaseAdmin()

  const hashes = buildHashes(uid, rows)
  const existingHashes = await fetchExistingHashes(supabase, uid, hashes)

  const toProcess = rows.map((row, i) => ({ row, hash: hashes[i], duplicate: existingHashes.has(hashes[i]) }))
  const novos = toProcess.filter((x) => !x.duplicate)
  const ignoradas = toProcess.length - novos.length

  log.info('[import] deduplicação', { total: rows.length, novos: novos.length, ignoradas })

  if (!novos.length) {
    return { importadas: 0, ignoradas, erros: 0, despesas: 0, receitas: 0, semCategoria: 0 }
  }

  const categorias = await getCategorias(uid)
  const cats = await categorizarBatch(novos.map((x) => x.row), categorias)

  let importadas = 0, erros = 0, despesas = 0, receitas = 0, semCategoria = 0

  for (let i = 0; i < novos.length; i++) {
    const { row, hash } = novos[i]
    let { categoria_id, subcategoria_id } = cats[i] || {}

    let ehFallback = false
    if (!categoria_id) {
      const fb = resolveFallbackCategoria(categorias, row.tipo)
      categoria_id = fb.categoria_id
      subcategoria_id = fb.subcategoria_id
      ehFallback = true
    }

    try {
      await inserirTransacao({
        usuario_id: uid,
        tipo: row.tipo,
        valor: row.valor,
        descricao: row.descricao,
        data_transacao: `${row.data}T12:00:00.000Z`,
        categoria_id: categoria_id || null,
        subcategoria_id: subcategoria_id || null,
        status: 'EFETIVADA',
        origem_hash: hash,
      })
      importadas++
      if (row.tipo === 'DESPESA') despesas++
      else receitas++
      if (ehFallback) semCategoria++
    } catch (e) {
      erros++
      log.warn('[import] falha ao inserir linha', {
        descricao: row.descricao?.slice(0, 60),
        detail: String(e?.message || e).slice(0, 200),
      })
    }
  }

  const resumo = { importadas, ignoradas, erros, despesas, receitas, semCategoria }
  log.info('[import] concluído', resumo)
  return resumo
}
