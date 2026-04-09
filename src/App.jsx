import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import RouteTransitionSkeleton from './components/RouteTransitionSkeleton'
import SuperAdminOutlet from './components/SuperAdminOutlet'
import Cadastro from './pages/Cadastro'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Dashboard from './pages/Dashboard'
import Transacoes from './pages/Transacoes'
import Configuracoes from './pages/Configuracoes'
import Relatorios from './pages/Relatorios'
import Background from './components/Background'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import HorizonChat from './components/HorizonChat'
import AdminWhatsApp from './pages/AdminWhatsApp'
import AdminUsuarios from './pages/AdminUsuarios'
import AdminPagamentos from './pages/AdminPagamentos'
import Pagamento from './pages/Pagamento'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Background />
        <PwaInstallPrompt />
        <HorizonChat />
        <RouteTransitionSkeleton />
        <Routes>
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/login" element={<Login />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transacoes" element={<Transacoes />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/pagamento" element={<Pagamento />} />
          <Route element={<SuperAdminOutlet />}>
            <Route path="/admin/whatsapp" element={<AdminWhatsApp />} />
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
            <Route path="/admin/pagamentos" element={<AdminPagamentos />} />
          </Route>
          <Route path="/" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
