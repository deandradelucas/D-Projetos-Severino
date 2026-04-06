import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Cadastro from './pages/Cadastro'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Dashboard from './pages/Dashboard'
import Transacoes from './pages/Transacoes'
import Configuracoes from './pages/Configuracoes'
import Background from './components/Background'
import PwaInstallPrompt from './components/PwaInstallPrompt'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Background />
        <PwaInstallPrompt />
        <Routes>
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/login" element={<Login />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transacoes" element={<Transacoes />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
