import { registerAdminRoutes } from './register-admin.mjs'
import { registerAuthRoutes } from './register-auth.mjs'
import { registerAssinaturaRoutes } from './register-assinatura.mjs'
import { registerUsuarioPerfilRoutes } from './register-usuario-perfil.mjs'
import { registerTransacoesRoutes } from './register-transacoes.mjs'
import { registerAgendaRoutes } from './register-agenda.mjs'
import { registerPagamentosRoutes } from './register-pagamentos.mjs'
import { registerAiRoutes } from './register-ai.mjs'
import { registerWhatsappRoutes } from './register-whatsapp.mjs'

/** Regista todas as rotas `/api/*` (exceto health, montado em app.mjs). */
export function registerApiDomainRoutes(app) {
  registerAdminRoutes(app)
  registerAuthRoutes(app)
  registerAssinaturaRoutes(app)
  registerUsuarioPerfilRoutes(app)
  registerTransacoesRoutes(app)
  registerAgendaRoutes(app)
  registerPagamentosRoutes(app)
  registerAiRoutes(app)
  registerWhatsappRoutes(app)
}
