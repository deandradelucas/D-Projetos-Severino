import { log } from '../lib/logger.mjs'
import { assertAcessoAppUsuario } from '../lib/assinatura.mjs'
import {
  atualizarTelefoneUsuario,
  getPerfilUsuario,
  atualizarNomeUsuario,
  atualizarAvatarUsuario,
  atualizarPreferenciasUsuario,
  exportarDadosUsuario,
  solicitarExclusaoConta,
  revogarSessoesUsuario,
  contarSessoesUsuario,
} from '../lib/usuarios.mjs'
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

  // Editar nome de exibição
  app.patch('/api/usuarios/perfil/nome', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)
      let body
      try { body = await c.req.json() } catch { return c.json({ message: 'Corpo inválido.' }, 400) }
      try {
        const data = await atualizarNomeUsuario(usuarioId, body?.nome)
        return c.json({ message: 'Nome atualizado.', perfil: { nome: data.nome } })
      } catch (e) {
        return c.json({ message: e.message || 'Erro ao atualizar nome.' }, 400)
      }
    } catch (error) {
      log.error('patch perfil nome failed', error)
      return c.json({ message: 'Erro ao atualizar nome.' }, 500)
    }
  })

  // Foto de perfil (avatar) — data URL base64 ou null para remover
  app.patch('/api/usuarios/perfil/avatar', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)
      let body
      try { body = await c.req.json() } catch { return c.json({ message: 'Corpo inválido.' }, 400) }
      try {
        const data = await atualizarAvatarUsuario(usuarioId, body?.avatar_url ?? null)
        return c.json({ message: 'Foto atualizada.', perfil: { avatar_url: data.avatar_url } })
      } catch (e) {
        return c.json({ message: e.message || 'Erro ao atualizar foto.' }, 400)
      }
    } catch (error) {
      log.error('patch perfil avatar failed', error)
      return c.json({ message: 'Erro ao atualizar foto.' }, 500)
    }
  })

  // Preferências (notificações + financeiras)
  app.patch('/api/usuarios/perfil/preferencias', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)
      let body
      try { body = await c.req.json() } catch { return c.json({ message: 'Corpo inválido.' }, 400) }
      const prefs = await atualizarPreferenciasUsuario(usuarioId, body?.preferencias ?? body)
      return c.json({ message: 'Preferências salvas.', preferencias: prefs })
    } catch (error) {
      log.error('patch perfil preferencias failed', error)
      return c.json({ message: 'Erro ao salvar preferências.' }, 500)
    }
  })

  // Sessões ativas (contagem)
  app.get('/api/usuarios/sessoes', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const total = await contarSessoesUsuario(usuarioId)
      return c.json({ total })
    } catch (error) {
      log.error('get sessoes failed', error)
      return c.json({ message: 'Erro ao contar sessões.' }, 500)
    }
  })

  // Encerrar todas as outras sessões (sair de todos os dispositivos)
  app.post('/api/usuarios/sessoes/encerrar', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      await revogarSessoesUsuario(usuarioId)
      return c.json({ message: 'Sessões encerradas. Faça login novamente nos outros dispositivos.' })
    } catch (error) {
      log.error('encerrar sessoes failed', error)
      return c.json({ message: 'Erro ao encerrar sessões.' }, 500)
    }
  })

  // Exportar dados (LGPD)
  app.get('/api/usuarios/exportar', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const gate = await assertAcessoAppUsuario(usuarioId)
      if (gate) return c.json({ message: gate.message }, gate.status)
      const dados = await exportarDadosUsuario(usuarioId)
      c.header('Content-Disposition', 'attachment; filename="severino-meus-dados.json"')
      return c.json(dados)
    } catch (error) {
      log.error('exportar dados failed', error)
      return c.json({ message: 'Erro ao exportar dados.' }, 500)
    }
  })

  // Excluir conta (LGPD) — desativa, marca e revoga sessões
  app.post('/api/usuarios/excluir-conta', async (c) => {
    try {
      const usuarioId = resolveRequestUserId(c)
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      let body
      try { body = await c.req.json() } catch { body = {} }
      if (String(body?.confirmacao || '').trim().toUpperCase() !== 'EXCLUIR') {
        return c.json({ message: 'Confirmação inválida.' }, 400)
      }
      await solicitarExclusaoConta(usuarioId)
      return c.json({ message: 'Conta desativada. Sentiremos sua falta.' })
    } catch (error) {
      if (error?.statusCode) {
        return c.json({ message: error.message }, error.statusCode)
      }
      log.error('excluir conta failed', error)
      return c.json({ message: 'Erro ao excluir conta.' }, 500)
    }
  })
}
