# Agenda com WhatsApp

## Fluxos n8n

- `docs/n8n-whatsapp-bot.json`: recebe mensagens da Evolution API e chama `/api/whatsapp/bot/mensagem`.
- `docs/n8n-agenda-reminders.json`: roda a cada 5 minutos e chama `/api/cron/agenda-lembretes`; o backend busca, envia pela Evolution API e registra os lembretes enviados.

## Variáveis necessárias no n8n

- `HORIZONTE_API_URL`: URL pública do app, sem barra final.
- `CRON_SECRET`: opcional; para o fluxo de lembretes o n8n também pode usar `AGENDA_REMINDER_SECRET` ou `WHATSAPP_BOT_SECRET`.
- `WHATSAPP_BOT_SECRET`: segredo já usado pelo bot inbound.
- `AGENDA_REMINDER_SECRET`: opcional para o endpoint legado `/api/agenda/lembretes/pendentes`; se não existir, a API aceita `WHATSAPP_BOT_SECRET`.
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

## Áudio no WhatsApp

O endpoint `/api/whatsapp/bot/mensagem` aceita texto ou áudio. Para áudio, envie no body `audioBase64` ou `audioUrl` com `mimeType`.

O backend transcreve com Gemini (`GEMINI_API_KEY`) e envia o texto transcrito para o mesmo parser que já entende despesas, receitas e agenda.

Se a Evolution enviar apenas o ID da mensagem de mídia, o backend busca o base64 em `/chat/getBase64FromMediaMessage/{instance}`. Para isso, configure `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` no ambiente da API.
