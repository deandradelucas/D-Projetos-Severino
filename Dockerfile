# API Severino (Hono) — EasyPanel, Coolify, Fly.io, etc.
# Porta interna: 3001 (ajusta API_PORT no painel se o proxy usar outra).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Obrigatório em container: escutar em todas as interfaces
ENV API_HOST=0.0.0.0
ENV API_PORT=3001
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server ./server
CMD ["node", "server/index.mjs"]
EXPOSE 3001
