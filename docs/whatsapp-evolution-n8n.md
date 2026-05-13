# Evolution API → n8n → Severino (WhatsApp)

Este é o caminho quando a **Evolution** não chama o Severino direto, mas um **Webhook do n8n** que depois faz `POST` em `/api/whatsapp/bot/mensagem`.

## 1. O problema mais comum: `webhook_by_events`

Na [documentação da Evolution v2](https://doc.evolution-api.com/v2/en/configuration/webhooks), com **`webhook_by_events: true`** a Evolution **acrescenta um sufixo ao URL** por evento, por exemplo:

| Evento            | URL chamada (exemplo)                    |
|-------------------|------------------------------------------|
| `MESSAGES_UPSERT` | `…/webhook/abc`**`/messages-upsert`**   |

O nó **Webhook** do n8n escuta **um path fixo** (ex.: `…/webhook/abc`). Pedidos para `…/webhook/abc/messages-upsert` **não batem** no trigger → **nenhuma execução**, texto e áudio “somem”.

**Regra:** na instância Evolution que aponta para o n8n, use **`webhook_by_events: false`** (ou `webhookByEvents: false` no JSON da API). O corpo do POST traz o tipo de evento (ex.: `event` / `type`); o workflow filtra no primeiro nó se precisar.

## 2. Configurar webhook na Evolution (instância)

1. Manager da Evolution (ou `POST /webhook/instance/{instance}` com header `apikey`).
2. **`url`:** URL **completa** do Webhook do n8n (modo produção), ex.:  
   `https://n8n.seudominio.com/webhook/severino-whatsapp`
3. **`enabled`:** `true`
4. **`webhook_by_events`:** `false` (recomendado com n8n).
5. **`events`:** inclua pelo menos **`MESSAGES_UPSERT`** (mensagens recebidas, incluindo áudio).
6. **`webhook_base64`:** pode ficar `false`; o Severino obtém mídia via `getBase64FromMediaMessage` quando precisa.

## 3. Fluxo no n8n

1. **Trigger:** Webhook (POST). O corpo pode vir em `body` — o código gerado por `npm run n8n:push` usa `const root = $json.body || $json`.
3. **Extrair telefone e mensagem** (nome do nó esperado pelo script de push): normaliza `data` / `data.messages[]`, monta `phone`, `remoteJid`, `remoteJidAlt`, áudio e envia **`rawEvolutionData: { data }`** para o Severino conseguir chamar `getBase64FromMediaMessage` quando não houver URL/base64 no JSON.
3. **Processar no Horizonte:** `POST` para a API do Severino  
   `https://<seu-app>/api/whatsapp/bot/mensagem`  
   com header **`Authorization: Bearer <WHATSAPP_BOT_SECRET>`** e JSON alinhado ao que o script envia (incluindo `remoteJid` e `remoteJidAlt` para áudio e `@lid`).

Atualizar o código dos nós no n8n a partir do repo:

```bash
npm run n8n:push
```

## 4. Caminho alternativo (sem n8n)

Evolution → Severino direto:

- URL: `https://<api>/api/whatsapp/webhook/<WHATSAPP_WEBHOOK_TOKEN>`
- Rotas também aceitam sufixo opcional `/:event` (ex.: `messages-upsert`) para compatibilidade com `webhook_by_events: true` no servidor.

Ver `README.md` (secção Docker) e `docker-compose.yml` para o exemplo local.

## 5. Checklist rápido

- [ ] Webhook da instância Evolution aponta para o **URL exato** do n8n (sem path extra se `webhook_by_events` estiver mal configurado).
- [ ] **`webhook_by_events: false`** na Evolution que alimenta o n8n.
- [ ] Evento **`MESSAGES_UPSERT`** ativo.
- [ ] n8n workflow **ativo** (não só “test”).
- [ ] `npm run n8n:push` depois de mudar o script no repositório.
- [ ] Severino em produção com `WHATSAPP_BOT_SECRET`, `GEMINI_API_KEY` (transcrição de áudio), e variáveis Evolution (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`).
