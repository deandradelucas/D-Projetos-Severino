import { apiFetch } from './apiFetch'
import { apiUrl } from './apiUrl'
import { redirectSeAuthBloqueada } from './authRedirect'

/**
 * Busca as categorias do usuário (`/api/categorias`). Centraliza o fetch que
 * estava duplicado em Transacoes, TransactionModal, Relatorios e ListaModais.
 * Trata 401/403 (redirect) de forma consistente.
 *
 * @returns {Promise<Array|null>} array de categorias; `[]` em falha de rede/HTTP;
 *   `null` quando houve redirect de auth (o chamador deve abortar).
 */
export async function fetchCategorias() {
  try {
    const res = await apiFetch(apiUrl('/api/categorias'), { cache: 'no-store' })
    if (redirectSeAuthBloqueada(res)) return null
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
