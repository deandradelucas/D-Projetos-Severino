import './load-env.mjs'

/**
 * Debounce por chave: evita spam de alertas do mesmo tipo.
 * Chaves específicas (ex: gemini-key-invalid) têm janela maior.
 */
const _lastSent = new Map()
const DEBOUNCE_MS = {
  default: 5 * 60 * 1000,   // 5 min para erros gerais
  critical: 2 * 60 * 1000,  // 2 min para erros críticos únicos
  startup: 0,                // sempre envia (startup é 1 vez)
}

function canSend(key, debounceKey = 'default') {
  const windowMs = DEBOUNCE_MS[debounceKey] ?? DEBOUNCE_MS.default
  if (windowMs === 0) return true
  const last = _lastSent.get(key) ?? 0
  if (Date.now() - last < windowMs) return false
  _lastSent.set(key, Date.now())
  return true
}

/**
 * Envia notificação para o Telegram. Nunca lança exceção — falha silenciosa.
 *
 * @param {string} message  Texto da mensagem (suporta Markdown simples: *negrito*, `code`)
 * @param {object} opts
 * @param {string} opts.key         Chave de deduplicate (ex: 'gemini-key-invalid')
 * @param {'error'|'warn'|'info'|'startup'} opts.level  Nível do alerta
 * @param {string} [opts.debounce]  'default' | 'critical' | 'startup'
 */
export async function notifyTelegram(message, { key = 'default', level = 'error', debounce = 'default', chatId: chatIdOverride } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = chatIdOverride || process.env.TELEGRAM_CHAT_ID?.trim()
  if (!token || !chatId) return

  if (!canSend(key, debounce)) return

  const emoji = { error: '🔴', warn: '🟡', info: '🔵', startup: '🟢' }[level] ?? '⚪'
  const now = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const text = `${emoji} *Severino API* — ${now}\n\n${message}`

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      // Tenta sem Markdown se parse falhar (ex: caracteres especiais)
      if (res.status === 400) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: text.replace(/[*_`]/g, ''), parse_mode: 'HTML' }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {})
      }
    }
  } catch {
    // Falha silenciosa — Telegram nunca deve afetar o app
  }
}

/**
 * Helpers pré-formatados para os alertas mais comuns.
 */
export const Alerts = {
  geminiKeyInvalid: () =>
    notifyTelegram(
      '🔑 *Chave Gemini expirou ou é inválida*\n\nAcesse https://aistudio.google.com/app/apikey, gere uma nova e atualize `/home/lucas/severino/.env`, depois reinicie:\n`pm2 restart severino --update-env`',
      { key: 'gemini-key-invalid', level: 'error', debounce: 'critical' },
    ),

  geminiQuota: () =>
    notifyTelegram(
      '⚠️ *Quota Gemini esgotada*\n\nLimite da API atingido. Verifique em Google AI Studio e aguarde reset ou upgrade de plano.',
      { key: 'gemini-quota', level: 'warn' },
    ),

  geminiGenericFail: (detail = '') =>
    notifyTelegram(
      `🤖 *Falha na IA Gemini*\n\n${detail ? `Detalhe: \`${detail.slice(0, 200)}\`` : 'Nenhum detalhe disponível.'}\n\nVerifique logs: \`pm2 logs severino --lines 50\``,
      { key: 'gemini-generic', level: 'warn' },
    ),

  serverError: (path = '', errMsg = '') =>
    notifyTelegram(
      `💥 *Erro interno não tratado*\n\nRota: \`${path || '?'}\`\nErro: \`${String(errMsg).slice(0, 300)}\``,
      { key: 'unhandled-error', level: 'error' },
    ),

  pm2Crash: (restarts = 0) =>
    notifyTelegram(
      `🔁 *PM2 reiniciou inesperadamente*\n\nProcesso \`severino\` reiniciou ${restarts}x desde o último check.\n\nVerifique: \`pm2 logs severino --lines 50\``,
      { key: 'pm2-crash', level: 'error', debounce: 'critical' },
    ),

  serverStarted: (port = 3001) =>
    notifyTelegram(
      `🟢 *Servidor iniciado* na porta ${port}`,
      { key: 'startup', level: 'startup', debounce: 'startup' },
    ),

  novaAssinaturaPaga: ({ nome = '', email = '?', valor = 0, metodo = '?', paymentId = '' }) => {
    const metodoLabel = { PIX: 'Pix', CREDIT_CARD: 'Cartão', BOLETO: 'Boleto' }[metodo] ?? metodo
    return notifyTelegram(
      `💰 *Nova assinatura paga*\n\n${nome ? `👤 *Nome:* ${nome}\n` : ''}📧 *Email:* ${email}\n💵 *Valor:* R$ ${Number(valor).toFixed(2)}\n💳 *Método:* ${metodoLabel}`,
      { key: `assinatura-paga-${paymentId || email}`, level: 'info', debounce: 'startup' },
    )
  },

  assinaturaCancelada: ({ nome = '', email = '?', motivo = 'cancelada' }) =>
    notifyTelegram(
      `🚨 *Assinatura ${motivo}*\n\n${nome ? `👤 *Nome:* ${nome}\n` : ''}📧 *Email:* ${email}\n\nVerifique no painel Asaas.`,
      { key: `assinatura-churn-${email}`, level: 'warn' },
    ),

  smtpFail: ({ to = '?', subject = '?', error = '' }) =>
    notifyTelegram(
      `📧 *Falha no envio de e-mail*\n\nPara: \`${to}\`\nAssunto: \`${subject}\`\nErro: \`${String(error).slice(0, 200)}\`\n\nVerifique as credenciais SMTP.`,
      { key: 'smtp-fail', level: 'error' },
    ),

  whatsappBotFailed: (phone = '', detail = '') =>
    notifyTelegram(
      `📱 *WhatsApp Bot — falha ao processar mensagem*\n\nTelefone: \`+${phone || '?'}\`\n${detail ? `Erro: \`${String(detail).slice(0, 300)}\`` : ''}\n\nVerifique: \`pm2 logs severino --lines 50\``,
      { key: `whatsapp-bot-fail-${phone}`, level: 'error', debounce: 'critical' },
    ),

  whatsappSendFailed: (phone = '') =>
    notifyTelegram(
      `📱 *WhatsApp Bot — resposta não enviada*\n\nO bot gerou uma resposta mas *não conseguiu enviar* pelo WhatsApp\\.\nTelefone: \`+${phone || '?'}\`\n\nVerifique a Evolution API e a conexão da instância Severino\\.\`pm2 logs severino --lines 20\``,
      { key: `whatsapp-send-fail-${phone}`, level: 'warn', debounce: 'critical' },
    ),

  novoCadastro: ({ nome, email, telefone }) => {
    const token  = process.env.TELEGRAM_BOT_TOKEN_CADASTROS?.trim()
    const chatId = process.env.TELEGRAM_CHAT_ID_CADASTROS?.trim()
    if (!token || !chatId) return Promise.resolve()
    const tel = telefone ? `+${telefone}` : '—'
    const now = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    const text = `🎉 *Novo membro cadastrado*\n\n👤 *Nome:* ${nome}\n📧 *Email:* ${email}\n📱 *Telefone:* ${tel}\n🕐 ${now}`
    return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {})
  },
}
