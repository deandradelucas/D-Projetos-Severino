import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/plus-jakarta-sans/wght.css'
import 'line-awesome/dist/line-awesome/css/line-awesome.min.css'
import './index.css'
import './styles/legacy/from-index.css'
import App from './App.jsx'
import { registerServiceWorker } from './registerServiceWorker'

registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
