/**
 * Interpreta respostas JSON da API (Hono: `{ message }`, Vercel catch-all: `{ error }`).
 * Evita duplicar lógica em cada `fetch` e mantém mensagens consistentes para o utilizador.
 */

function defaultMessageForHttpStatus(status) {
  if (status === 401) return 'Não autorizado.'
  if (status === 403) return 'Acesso negado.'
  if (status === 404) return 'Recurso não encontrado.'
  if (status === 422) return 'Não foi possível concluir o pedido.'
  if (status === 429) return 'Muitas tentativas. Aguarde e tente de novo.'
  if (status >= 500) return 'Serviço indisponível. Tente novamente em instantes.'
  return `Erro ${status}.`
}

/**
 * Extrai mensagem amigável do payload já parseado.
 * @param {number} status - HTTP status
 * @param {unknown} data - objeto JSON ou vazio
 */
export function messageFromApiPayload(status, data) {
  if (data && typeof data === 'object') {
    const m = data.message
    if (typeof m === 'string' && m.trim()) return m.trim()
    const e = data.error
    if (typeof e === 'string' && e.trim()) return e.trim()
  }
  return defaultMessageForHttpStatus(status)
}

/**
 * Lê `Response` de fetch, faz parse JSON e devolve resultado tipado para o fluxo da UI.
 * @returns {Promise<{ ok: boolean, status: number, data: object, parseOk: boolean, userMessage?: string }>}
 */
export async function parseApiJsonResponse(res) {
  const text = await res.text()
  let data = {}
  let parseOk = true
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    parseOk = false
  }

  if (!parseOk) {
    return {
      ok: false,
      status: res.status,
      data: {},
      parseOk: false,
      userMessage:
        res.status >= 500
          ? defaultMessageForHttpStatus(503)
          : `Resposta inválida do servidor (${res.status}).`,
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data,
      parseOk: true,
      userMessage: messageFromApiPayload(res.status, data),
    }
  }

  return { ok: true, status: res.status, data, parseOk: true }
}
