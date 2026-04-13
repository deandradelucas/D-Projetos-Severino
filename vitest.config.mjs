import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['server/tests/**/*.test.mjs', 'src/**/*.test.{js,jsx,ts,tsx,mjs}'],
    setupFiles: ['src/tests/setup-vitest.js'],
  },
})
