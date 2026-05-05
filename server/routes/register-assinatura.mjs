import { log } from '../lib/logger.mjs'
import { getPerfilUsuario } from '../lib/usuarios.mjs'
import { buildAssinaturaUsuarioPayload, marcarBemVindoPagamentoVisto } from '../lib/assinatura.mjs'

export function registerAssinaturaRoutes(app) {
  app.get('/api/assinatura/status', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      const perfil = await getPerfilUsuario(usuarioId)
      if (!perfil) return c.json({ message: 'Perfil não encontrado.' }, 404)
      const assinatura = await buildAssinaturaUsuarioPayload(usuarioId, perfil)
      return c.json(assinatura)
    } catch (error) {
      log.error('assinatura status failed', error)
      return c.json({
        trial_ends_at: null,
        bem_vindo_pagamento_visto_at: null,
        assinatura_paga: false,
        acesso_app_liberado: true,
        mostrar_bem_vindo_assinatura: false,
        trial_dias_gratis: 7,
        assinatura_proxima_cobranca: null,
        assinatura_mp_status: null,
        plano_preco_mensal: Number.parseFloat(process.env.HORIZONTE_PLANO_PRECO || '10') || 10,
        assinatura_situacao: 'inativa',
        assinatura_mp_bloqueada: false,
        motivo_bloqueio_acesso: null,
        mp_gerenciar_url: null,
      })
    }
  })

  app.post('/api/assinatura/bem-vindo-visto', async (c) => {
    try {
      const usuarioId = c.req.header('x-user-id')
      if (!usuarioId) return c.json({ message: 'Não autorizado.' }, 401)
      await marcarBemVindoPagamentoVisto(usuarioId)
      const perfil = await getPerfilUsuario(usuarioId)
      if (!perfil) return c.json({ message: 'Perfil não encontrado.' }, 404)
      const assinatura = await buildAssinaturaUsuarioPayload(usuarioId, perfil)
      return c.json({ ok: true, ...assinatura })
    } catch (error) {
      log.error('bem-vindo-visto failed', error)
      return c.json({ message: 'Erro ao atualizar.' }, 500)
    }
  })
}
