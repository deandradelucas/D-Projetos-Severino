/**
 * Limpa TODOS os caches persistidos do usuário no localStorage (dados
 * financeiros de cold start). DEVE ser chamado em qualquer fluxo de logout —
 * em device compartilhado, o próximo usuário não pode ver resíduo do anterior.
 * (Achado CACHE-01 da auditoria de 11-jun.)
 */
import { clearTxCache } from './txCachePersist'
import { clearListasCache } from './listasCachePersist'
import { clearCartoesCache } from './cartoesCachePersist'
import { clearAgendaCache } from './agendaCachePersist'
import { clearInvestimentosCache } from './investimentosCachePersist'
import { clearMetasCache } from './metasCachePersist'
import { clearRelatoriosCache } from './relatoriosCachePersist'

export function clearAllUserCaches(usuarioId) {
  const id = usuarioId != null ? String(usuarioId).trim() : ''
  if (!id) return
  try { clearTxCache(id) } catch { /* ignore */ }
  try { clearListasCache(id) } catch { /* ignore */ }
  try { clearCartoesCache(id) } catch { /* ignore */ }
  try { clearAgendaCache(id) } catch { /* ignore */ }
  try { clearInvestimentosCache(id) } catch { /* ignore */ }
  try { clearMetasCache(id) } catch { /* ignore */ }
  try { clearRelatoriosCache(id) } catch { /* ignore */ }
}
