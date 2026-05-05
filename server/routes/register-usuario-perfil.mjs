import { log } from '../lib/logger.mjs'
import { assertAcessoAppUsuario } from '../lib/assinatura.mjs'
import { getPerfilUsuario } from '../lib/usuarios.mjs'

export function registerUsuarioPerfilRoutes(app) {
  app.get('/api/usuarios/perfil', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
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
}
