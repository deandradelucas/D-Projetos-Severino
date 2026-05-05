import { Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { TransactionCacheProvider } from './context/TransactionCacheContext'
import RoutePageFallback from './components/RoutePageFallback'
import SuperAdminOutlet from './components/SuperAdminOutlet'
import AppSessionOutlet from './components/AppSessionOutlet'
import Background from './components/Background'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import HorizonChat from './components/HorizonChat'
import ShellStickyHeaderScroll from './components/ShellStickyHeaderScroll'
import ToastContainer from './components/Toast'
import {
  Login,
  Cadastro,
  Dashboard,
  Transacoes,
  Configuracoes,
  Relatorios,
  Agenda,
  AdminUsuarios,
  AdminPagamentos,
  Pagamento,
  BemVindoAssinatura,
} from './lazyRoutes'

function App() {
  return (
    <ThemeProvider>
      <TransactionCacheProvider>
      <BrowserRouter>
        <a href="#app-main" className="skip-to-main">
          Saltar para o conteúdo
        </a>
        <ShellStickyHeaderScroll />
        <ToastContainer />
        <div className="app-layout-shell">
          <Background />
          <PwaInstallPrompt />
          <HorizonChat />
          <div className="app-routes-grow" id="app-main" tabIndex={-1}>
            <Suspense fallback={<RoutePageFallback />}>
              <Routes>
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/login" element={<Login />} />
                <Route element={<AppSessionOutlet requireAppAccess={false} />}>
                  <Route path="/bem-vindo-assinatura" element={<BemVindoAssinatura />} />
                  <Route path="/pagamento" element={<Pagamento />} />
                </Route>
                <Route element={<AppSessionOutlet requireAppAccess />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/transacoes" element={<Transacoes />} />
                  <Route path="/relatorios" element={<Relatorios />} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </Route>
                <Route element={<SuperAdminOutlet />}>
                  <Route path="/admin/usuarios" element={<AdminUsuarios />} />
                  <Route path="/admin/pagamentos" element={<AdminPagamentos />} />
                </Route>
                <Route path="/" element={<Login />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </BrowserRouter>
      </TransactionCacheProvider>
    </ThemeProvider>
  )
}

export default App
