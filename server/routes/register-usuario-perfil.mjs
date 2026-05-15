import { log } from '../lib/logger.mjs'
import { assertAcessoAppUsuario } from '../lib/assinatura.mjs'
import { atualizarTelefoneUsuario, getPerfilUsuario } from '../lib/usuarios.mjs'
import { resolveRequestUserId } from '../lib/http/resolve-request-user-id.mjs'

function validarCelularBr(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length !== 11) {
    return { ok: false, message: 'Informe celular com DDD (11 dígitos).' }
  }
  if (digits[2] !== '9') {
    return { ok: false, message: 'Informe um número de celular (9 após o DDD).' }
  }
  return { ok: true, digits }
}

export function registerUsuarioPerfilRoutes(app) {
  app.get('/api/usuarios/perfil', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      const perfil = await getPerfilUsuario(usuarioId)
      return c.json({ perfil })
    } catch (error) {
      log.error('get perfil failed', error)
      return c.json({ message: 'Erro ao buscar perfil.' }, 500)
    }
  })

  app.patch('/api/usuarios/perfil/telefone', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)

      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)

      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ message: 'Corpo da requisição inválido.' }, 400)
      }

      const check = validarCelularBr(body?.telefone)
      if (!check.ok) return c.json({ message: check.message }, 400)

      try {
        await atualizarTelefoneUsuario(usuarioId, check.digits)
      } catch (error) {
        if (error instanceof Error && error.message.includes('cadastrado')) {
          return c.json({ message: error.message }, 409)
        }
        throw error
      }

      const perfil = await getPerfilUsuario(usuarioId)
      if (!perfil) return c.json({ message: 'Perfil não encontrado.' }, 404)

      return c.json({
        message: 'Telefone atualizado.',
        perfil: {
          telefone: perfil.telefone ?? check.digits,
        },
      })
    } catch (error) {
      log.error('patch perfil telefone failed', error)
      return c.json({ message: 'Erro ao atualizar telefone.' }, 500)
    }
  })
}
