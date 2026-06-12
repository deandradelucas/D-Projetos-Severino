import { apiFetch } from './apiFetch'
import { apiUrl } from './apiUrl'

/** Executa uma mutação de categoria e devolve o JSON, ou lança Error com a mensagem da API. */
async function mutate(path, { method = 'POST', body } = {}) {
  const res = await apiFetch(apiUrl(path), {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || 'Não foi possível completar a ação.')
  return data
}

/** GET simples que devolve JSON ou um fallback em erro. */
async function get(path, fallback) {
  try {
    const res = await apiFetch(apiUrl(path), { cache: 'no-store' })
    if (!res.ok) return fallback
    return await res.json()
  } catch {
    return fallback
  }
}

export const getUsoCategorias = () => get('/api/categorias/uso', { categorias: {}, subcategorias: {} })

// Orçamento por categoria (#3) — limite mensal + gasto do mês.
export const getOrcamentos = () => get('/api/limites-orcamento/status', [])
export const setOrcamento = (categoriaId, limiteMensal) =>
  mutate('/api/limites-orcamento', { method: 'POST', body: { categoria_id: categoriaId, limite_mensal: limiteMensal } })
export const removerOrcamento = (categoriaId) => mutate(`/api/limites-orcamento/${categoriaId}`, { method: 'DELETE' })
export const listarSubcategoriasArquivadas = (categoriaId) =>
  get(`/api/categorias/${categoriaId}/subcategorias-arquivadas`, [])
export const restaurarSubcategoria = (id) => mutate(`/api/subcategorias/${id}/restaurar`, { method: 'POST' })
export const podarSubcategoriasSemUso = (categoriaId) =>
  mutate(`/api/categorias/${categoriaId}/podar-subcategorias`, { method: 'POST' })
export const restaurarCategoriasPadrao = () =>
  mutate('/api/categorias/restaurar-padrao', { method: 'POST' })

export const criarCategoria = (body) => mutate('/api/categorias', { method: 'POST', body })
export const atualizarCategoria = (id, body) => mutate(`/api/categorias/${id}`, { method: 'PUT', body })
export const removerCategoria = (id) => mutate(`/api/categorias/${id}`, { method: 'DELETE' })
export const fundirCategoria = (id, destinoId) =>
  mutate(`/api/categorias/${id}/fundir`, { method: 'POST', body: { destino_id: destinoId } })
export const criarSubcategoria = (categoriaId, body) =>
  mutate(`/api/categorias/${categoriaId}/subcategorias`, { method: 'POST', body })
export const atualizarSubcategoria = (id, body) =>
  mutate(`/api/subcategorias/${id}`, { method: 'PUT', body })
export const removerSubcategoria = (id) => mutate(`/api/subcategorias/${id}`, { method: 'DELETE' })

/** Ícones selecionáveis (mesmas chaves do backend / public/icons/categorias), por tema. */
export const ICONES_CATEGORIA = [
  // finanças
  'wallet', 'coins', 'handCoins', 'dollarCircle', 'moneybag', 'salary', 'piggy',
  'bank', 'investment', 'chart', 'bitcoin', 'crypto', 'percent', 'scale', 'receipt', 'tax', 'idcard',
  // alimentação
  'utensils', 'coffee', 'pizza', 'beer', 'wine', 'cake', 'groceries',
  // transporte
  'car', 'fuel', 'gas', 'bus', 'train', 'taxi', 'motorcycle', 'bicycle', 'parking', 'plane', 'luggage',
  // casa
  'home', 'building', 'hotel', 'plant', 'flower', 'tools', 'paint', 'bolt', 'electricity', 'water', 'broom', 'trash', 'lock',
  // saúde / cuidados
  'health', 'hospital', 'pharmacy', 'tooth', 'fitness', 'running', 'yoga', 'spa', 'scissors', 'makeup',
  // compras
  'shopping', 'tshirt', 'shoes', 'ring',
  // lazer / tecnologia
  'leisure', 'tech', 'internet', 'wifi', 'tv', 'camera', 'music', 'movie', 'book', 'newspaper', 'beach', 'umbrella', 'star', 'heart', 'sparkles', 'gift',
  // pessoas / diversos
  'child', 'baby', 'dog', 'cat', 'pet', 'education', 'work', 'church', 'charity', 'calendar', 'subscription', 'pix',
]

/** Paleta de cores sugeridas (consistente com o seed). */
export const CORES_CATEGORIA = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#d4a84b', '#94a3b8',
]
