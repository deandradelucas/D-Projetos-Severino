import { lazy } from 'react'

const loadLogin = () => import('./pages/Login.jsx')
export const Login = lazy(loadLogin)

const loadCadastro = () => import('./pages/Cadastro.jsx')
export const Cadastro = lazy(loadCadastro)

const loadDashboard = () => import('./pages/Dashboard.jsx')
export const Dashboard = lazy(loadDashboard)

const loadTransacoes = () => import('./pages/Transacoes.jsx')
export const Transacoes = lazy(loadTransacoes)

const loadInvestimentos = () => import('./pages/Investimentos.jsx')
export const Investimentos = lazy(loadInvestimentos)

const loadConfiguracoes = () => import('./pages/Configuracoes.jsx')
export const Configuracoes = lazy(loadConfiguracoes)

const loadRelatorios = () => import('./pages/Relatorios.jsx')
export const Relatorios = lazy(loadRelatorios)

const loadAgenda = () => import('./pages/Agenda.jsx')
export const Agenda = lazy(loadAgenda)

const loadListaDeCompras = () => import('./pages/ListaDeCompras.jsx')
export const ListaDeCompras = lazy(loadListaDeCompras)

const loadAdminUsuarios = () => import('./pages/AdminUsuarios.jsx')
export const AdminUsuarios = lazy(loadAdminUsuarios)

const loadAdminPagamentos = () => import('./pages/AdminPagamentos.jsx')
export const AdminPagamentos = lazy(loadAdminPagamentos)

const loadAdminAuditoria = () => import('./pages/AdminAuditoria.jsx')
export const AdminAuditoria = lazy(loadAdminAuditoria)

const loadAdminMarketing = () => import('./pages/AdminMarketing.jsx')
export const AdminMarketing = lazy(loadAdminMarketing)

const loadPagamento = () => import('./pages/Pagamento.jsx')
export const Pagamento = lazy(loadPagamento)

const loadBemVindoAssinatura = () => import('./pages/BemVindoAssinatura.jsx')
export const BemVindoAssinatura = lazy(loadBemVindoAssinatura)

const loadTrialExpirado = () => import('./pages/TrialExpirado.jsx')
export const TrialExpirado = lazy(loadTrialExpirado)

const ROUTE_PREFETCH = {
  '/': loadLogin,
  '/login': loadLogin,
  '/cadastro': loadCadastro,
  '/dashboard': loadDashboard,
  '/transacoes': loadTransacoes,
  '/investimentos': loadInvestimentos,
  '/configuracoes': loadConfiguracoes,
  '/relatorios': loadRelatorios,
  '/agenda': loadAgenda,
  '/lista-de-compras': loadListaDeCompras,
  '/admin/usuarios': loadAdminUsuarios,
  '/admin/pagamentos': loadAdminPagamentos,
  '/admin/auditoria': loadAdminAuditoria,
  '/admin/marketing': loadAdminMarketing,
  '/pagamento': loadPagamento,
  '/bem-vindo-assinatura': loadBemVindoAssinatura,
  '/trial-expirado': loadTrialExpirado,
}

const prefetched = new Set()

/** Mesmo `import()` que o lazy — aquece o chunk antes do clique (hover / toque). */
export function prefetchRoute(path) {
  const fn = ROUTE_PREFETCH[path]
  if (!fn || prefetched.has(path)) return
  prefetched.add(path)
  fn().catch(() => {
    prefetched.delete(path)
  })
}

// Apenas as 3 rotas mais leves e mais acessadas são pré-carregadas em idle.
// Investimentos (recharts 370KB + canvas 351KB) e Relatorios (jspdf 430KB + canvas 351KB)
// ficam fora: são carregados sob demanda ao navegar, não em background.
const APP_NAV_PATHS = ['/dashboard', '/transacoes', '/agenda']

/** Dispara `import()` de todas as telas do menu (deduplicado). Útil ao abrir o menu no mobile. */
export function prefetchAppNavChunksNow() {
  for (const path of APP_NAV_PATHS) {
    prefetchRoute(path)
  }
}

/**
 * Pré-carrega em idle (não compete com hidratação / primeiro paint).
 * `prefetchRoute` deduplica; seguro chamar após login.
 */
export function warmAuthenticatedNavChunks() {
  if (typeof window === 'undefined') return
  const run = () => prefetchAppNavChunksNow()
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1800 })
  } else {
    setTimeout(run, 180)
  }
}

/** Props para NavLink: desktop (hover), teclado (focus), mobile (pointer antes do clique). */
export function navPrefetchHandlers(path) {
  const run = () => prefetchRoute(path)
  return {
    onMouseEnter: run,
    onFocus: run,
    onPointerDown: run,
  }
}
