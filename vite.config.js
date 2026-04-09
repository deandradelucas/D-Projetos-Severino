import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('jspdf')) return 'vendor-jspdf'
          if (id.includes('html2canvas') || id.includes('canvg')) return 'vendor-canvas'
        },
      },
    },
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  /* `vite preview` (build + teste mobile na rede) — mesmo proxy que o dev server */
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
