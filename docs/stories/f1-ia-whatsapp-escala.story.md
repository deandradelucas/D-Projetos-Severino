# Story F1 — Escala da IA do WhatsApp (fase custo-zero)

**Status:** InReview (validado local, aguardando deploy+smoke) · **Origem:** Backlog pacote 5 / roadmap jun-2026 ("maior alavanca de escala")

## Verificação local (10/jun)
- Núcleo novo: `ai-cache.mjs` (+8 testes), `ai-telemetry.mjs` (+4 testes), `redis-shared.mjs` (getRedis extraído do rate-limit), `groq-client.mjs` ganhou `groqTranscribeAudio` (Whisper).
- Cabeamento (dev agent): cache+telemetria+fallback Groq em ai-whatsapp, ai-lista-compras, ai-category, ai-horizon, ai-relatorio, agenda-whatsapp — zero mudança no caminho feliz (Groq só após Gemini esgotar; cache só intercepta antes).
- `GET /api/health` expõe `groq.configured` + `ia` (telemetria do dia).
- VPS já tem GEMINI_API_KEY, GROQ_API_KEY e REDIS_URL → F1 roda completo em prod.

## Tasks

- [x] A. `ai-whatsapp.mjs` — cache parse-tx + telemetria + reestruturação catch→Groq (AC2, AC6, AC7)
- [x] B. `ai-whatsapp.mjs` — fallback Groq Whisper em `parseWhatsAppAudioDirectWithAI` (AC4)
- [x] C. `ai-lista-compras.mjs` — cache lista + fallback Groq + telemetria (AC2, AC3)
- [x] D. `ai-category.mjs` — cache single/batch item-a-item + fallback Groq + telemetria (AC2, AC3)
- [x] E. `ai-horizon.mjs` + `ai-relatorio.mjs` — fallback Groq + telemetria, sem cache (AC3, AC5)
- [x] F. `agenda-whatsapp.mjs` — cache titulo-agenda + telemetria nas funções Groq/Gemini (AC2, AC5)

## Problema
O bot WhatsApp depende do Gemini free (~teto prático de 37 usuários ativos/dia). Mapeamento (10/jun): texto=1 Gemini/msg (Groq só em erro HTTP), **áudio/lista/chat/categoria = 100% Gemini sem fallback**, zero cache. Estouro de quota = bot mudo.

## Solução (fase 1 — custo zero)
1. **Cache de respostas de IA** (Redis já em prod + fallback memória) nos fluxos determinísticos.
2. **Fallback Groq (Llama) em TODOS os fluxos de texto** que hoje não têm.
3. **Áudio via Groq Whisper** como fallback (transcreve → reusa o pipeline de texto).
4. **Telemetria de consumo** por provider/fluxo para medir o gargalo real e embasar a fase 2 (provider pago só com dados).

## Acceptance Criteria
1. Lib `server/lib/ai/ai-cache.mjs`: get/set com chave `sha256(kind|inputNormalizado|ctx)`, Redis (`REDIS_URL`) com fallback LRU em memória (max ~2000), TTL por tipo. Sem Redis, funciona igual (in-memory).
2. Cache aplicado em: parse de texto WhatsApp (TTL 24h, **chave inclui a data BRT** — "ontem/hoje" não vaza entre dias), parse de lista de compras (TTL 24h, chave com data), sugestão de categoria (TTL 7d, chave inclui hash da lista de categorias do usuário), título de agenda (TTL 24h, chave com data). **NÃO cachear:** chat (askHorizon), análise de relatório, áudio.
3. Fallback Groq adicionado a: lista de compras, sugestão de categoria (single + batch), askHorizon, análise de relatório. Disparo: depois de esgotar os modelos Gemini (mesmo critério do parse de texto), **incluindo quota/429/RESOURCE_EXHAUSTED**.
4. Áudio: se o Gemini falhar (todos os modelos), transcrever via **Groq Whisper** (`whisper-large-v3-turbo`) e seguir pelo pipeline de texto (que tem cache + fallback). Sem GROQ_API_KEY → comportamento atual.
5. Telemetria: contador diário por `provider:fluxo:resultado` (Redis INCR com TTL 48h; in-memory fallback) + `cache:hit/miss`; exposto em `GET /api/health` (campo `ia`) sem dados sensíveis.
6. Verificação de quota 429 no parse de texto: garantir que erro de quota do Gemini também cai pro Groq (hoje só erro HTTP 5xx).
7. Zero mudança de comportamento quando tudo verde (Gemini ok): mesmas respostas, só com cache na frente.
8. Testes: ai-cache (chave/TTL/normalização/data na chave), fallback chain do parse (mock), telemetria increments. lint+test:unit+build verdes.

## Out of scope (fase 2 — decisão CEO com dados da telemetria)
- Provider pago, balanceamento Groq-primário, streaming, fila de retry.

## File List (previsto)
- `server/lib/ai/ai-cache.mjs` (novo) · `server/lib/ai/ai-telemetry.mjs` (novo)
- `server/lib/ai/groq-client.mjs` (whisper) · `server/lib/ai-whatsapp.mjs` · `server/lib/ai-lista-compras.mjs` · `server/lib/ai-category.mjs` · `server/lib/ai-horizon.mjs` · `server/lib/ai-relatorio.mjs` · `server/lib/domain/agenda-whatsapp.mjs`
- `server/routes/health.mjs` · testes novos
