import { lazy } from 'react'

export const loadCadastro = () => import('./pages/Cadastro.jsx')
export const Cadastro = lazy(loadCadastro)

export const loadRedefinirSenha = () => import('./pages/RedefinirSenha.jsx')
export const RedefinirSenha = lazy(loadRedefinirSenha)

export const loadDashboard = () => import('./pages/Dashboard.jsx')
export const Dashboard = lazy(loadDashboard)

export const loadTransacoes = () => import('./pages/Transacoes.jsx')
export const Transacoes = lazy(loadTransacoes)

export const loadConfiguracoes = () => import('./pages/Configuracoes.jsx')
export const Configuracoes = lazy(loadConfiguracoes)

export const loadRelatorios = () => import('./pages/Relatorios.jsx')
export const Relatorios = lazy(loadRelatorios)

export const loadAdminWhatsApp = () => import('./pages/AdminWhatsApp.jsx')
export const AdminWhatsApp = lazy(loadAdminWhatsApp)

export const loadAdminUsuarios = () => import('./pages/AdminUsuarios.jsx')
export const AdminUsuarios = lazy(loadAdminUsuarios)

export const loadAdminPagamentos = () => import('./pages/AdminPagamentos.jsx')
export const AdminPagamentos = lazy(loadAdminPagamentos)

export const loadPagamento = () => import('./pages/Pagamento.jsx')
export const Pagamento = lazy(loadPagamento)

export const loadBemVindoAssinatura = () => import('./pages/BemVindoAssinatura.jsx')
export const BemVindoAssinatura = lazy(loadBemVindoAssinatura)

const ROUTE_PREFETCH = {
  '/cadastro': loadCadastro,
  '/redefinir-senha': loadRedefinirSenha,
  '/dashboard': loadDashboard,
  '/transacoes': loadTransacoes,
  '/configuracoes': loadConfiguracoes,
  '/relatorios': loadRelatorios,
  '/admin/whatsapp': loadAdminWhatsApp,
  '/admin/usuarios': loadAdminUsuarios,
  '/admin/pagamentos': loadAdminPagamentos,
  '/pagamento': loadPagamento,
  '/bem-vindo-assinatura': loadBemVindoAssinatura,
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

/** Props para NavLink: desktop (hover), teclado (focus), mobile (pointer antes do clique). */
export function navPrefetchHandlers(path) {
  const run = () => prefetchRoute(path)
  return {
    onMouseEnter: run,
    onFocus: run,
    onPointerDown: run,
  }
}
