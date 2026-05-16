/**
 * Helper para parse seguro de JSON no corpo da requisição Hono.
 * Retorna { ok: true, body } em sucesso ou { ok: false, response } em falha.
 */
export async function parseJsonBody(c) {
  try {
    return { ok: true, body: await c.req.json() }
  } catch {
    return { ok: false, response: c.json({ message: 'JSON inválido.' }, 400) }
  }
}
