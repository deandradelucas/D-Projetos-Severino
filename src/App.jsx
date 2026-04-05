import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Cadastro from './pages/Cadastro'
import Login from './pages/Login'
import Background from './components/Background'
import PwaInstallPrompt from './components/PwaInstallPrompt'

function App() {
  return (
    <BrowserRouter>
      <Background />
      <PwaInstallPrompt />
      <Routes>
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Cadastro />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
