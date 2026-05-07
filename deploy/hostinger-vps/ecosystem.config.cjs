/**
 * PM2 na VPS — na pasta do clone do repo:
 *   npm ci --omit=dev
 *   pm2 start deploy/hostinger-vps/ecosystem.config.cjs
 * Variáveis sensíveis: use .env na raiz do projeto ou pm2 ecosystem env_file (PM2 5+).
 */
module.exports = {
  apps: [
    {
      name: 'severino-api',
      cwd: '/var/www/severino',
      script: 'server/index.mjs',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        API_HOST: '127.0.0.1',
        API_PORT: '3001',
      },
    },
  ],
}
