import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Proxy /api → mesma porta que `server/index.mjs` (API_PORT no .env). */
function createApiProxy(apiTarget) {
  return {
    target: apiTarget,
    changeOrigin: true,
    configure(proxy) {
      proxy.on('error', (err, _req, res) => {
        if (!res || typeof res.writeHead !== 'function' || res.writableEnded || res.headersSent) {
          return
        }
        const unreachable =
          err?.code === 'ECONNREFUSED' ||
          err?.code === 'ETIMEDOUT' ||
          err?.code === 'ENOTFOUND'
        const message = unreachable
          ? `A API não responde em ${apiTarget}. Verifique se dev:api está ativo, se API_PORT no .env bate com essa URL e libere a porta se outro processo estiver usando-a.`
          : 'Falha ao encaminhar para a API local. Reinicie npm run dev ou confira os logs do servidor.'
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ message }))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /* process.env primeiro: scripts/dev.mjs define API_PORT dinâmico antes de subir o Vite */
  const apiPort = process.env.API_PORT || env.API_PORT || '3001'
  const apiTarget = `http://127.0.0.1:${apiPort}`
  const viteVercelFlag =
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true' ||
    env.VITE_VERCEL === '1' ||
    env.VITE_VERCEL === 'true'
      ? '1'
      : ''

  return {
    define: {
      'import.meta.env.VITE_VERCEL': JSON.stringify(viteVercelFlag),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'vendor-react'
            }
            if (id.includes('recharts')) return 'vendor-recharts'
            if (id.includes('jspdf')) return 'vendor-jspdf'
            if (id.includes('html2canvas') || id.includes('canvg')) return 'vendor-canvas'
          },
        },
      },
    },
    server: {
      host: true,
      port: Number(process.env.VITE_PORT) || 3010,
      strictPort: false,
      proxy: {
        '/api': createApiProxy(apiTarget),
      },
    },
    /* `vite preview` (build + teste mobile na rede) — mesmo proxy que o dev server */
    preview: {
      host: true,
      port: 4173,
      proxy: {
        '/api': createApiProxy(apiTarget),
      },
    },
  }
})
