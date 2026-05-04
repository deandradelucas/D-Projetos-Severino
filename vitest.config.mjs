import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/tests/**/*.test.mjs'],
        },
      },
      {
        test: {
          name: 'src',
          environment: 'jsdom',
          include: ['src/**/*.test.{js,jsx,ts,tsx,mjs}'],
          setupFiles: ['src/tests/setup-vitest.js'],
        },
      },
    ],
  },
})
