import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
/* Plus Jakarta Sans Variable — fonte premium em desktop (≥769px). Mobile mantém Poppins/Inter. */
import '@fontsource-variable/plus-jakarta-sans/wght.css'
import 'line-awesome/dist/line-awesome/css/line-awesome.min.css'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './registerServiceWorker'

registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
