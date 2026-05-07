import { assertAcessoAppUsuario } from '../assinatura.mjs'
import { assertFamiliaPodeEscrever, resolveEscopoUsuario } from '../conta-familiar.mjs'

/**
 * Resolve titular de dados (conta familiar) após gate de assinatura.
 * @param {string} actorId header x-user-id
 * @param {{ write?: boolean }} opts write=true exige papel diferente de VIEWER
 * @returns {Promise<{ ok: true, actorId: string, dataUsuarioId: string, escopo: Awaited<ReturnType<typeof resolveEscopoUsuario>> } | { ok: false, status: number, message: string }>}
 */
export async function parseUsuarioEscopoApi(actorId, opts = {}) {
  const uid = String(actorId || '').trim()
  if (!uid) {
    return { ok: false, status: 401, message: 'Não autorizado.' }
  }

  const gate = await assertAcessoAppUsuario(uid)
  if (gate) {
    return { ok: false, status: gate.status, message: gate.message }
  }

  let escopo
  try {
    escopo = await resolveEscopoUsuario(uid)
  } catch {
    return { ok: false, status: 401, message: 'Não autorizado.' }
  }

  if (opts.write) {
    const w = assertFamiliaPodeEscrever(escopo)
    if (w) {
      return { ok: false, status: w.status, message: w.message }
    }
  }

  return {
    ok: true,
    actorId: uid,
    dataUsuarioId: escopo.dataUsuarioId,
    escopo,
  }
}
