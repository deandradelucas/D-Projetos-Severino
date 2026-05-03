# Agenda com WhatsApp

## Fluxos n8n

- `docs/n8n-whatsapp-bot.json`: recebe mensagens da Evolution API e chama `/api/whatsapp/bot/mensagem`.
- `docs/n8n-agenda-reminders.json`: roda a cada 5 minutos, busca lembretes em `/api/agenda/lembretes/pendentes` e envia pelo endpoint `sendText` da Evolution API.

## Variáveis necessárias no n8n

- `HORIZONTE_API_URL`: URL pública do app, sem barra final.
- `WHATSAPP_BOT_SECRET`: segredo já usado pelo bot inbound.
- `AGENDA_REMINDER_SECRET`: opcional; se não existir, a API aceita `WHATSAPP_BOT_SECRET` para o fluxo de lembretes.
- `EVOLUTION_API_URL`: URL base da Evolution API.
- `EVOLUTION_INSTANCE`: nome da instância conectada ao WhatsApp.
- `EVOLUTION_API_KEY`: chave da Evolution API.

## Comandos suportados

- `agenda hoje`
- `próximos compromissos`
- `marcar reunião amanhã às 15h`
- `cancelar 1`
- `confirmar 1`
- `concluir 1`
- `reagendar 1 para sexta 10h`
- `me avise 30 minutos antes`

Os números dos comandos correspondem à lista retornada por `agenda hoje` ou `próximos compromissos`. Também é possível usar o código curto do compromisso exibido nas respostas.
