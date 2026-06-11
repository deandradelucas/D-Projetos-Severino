import { registerAuthRoutes } from './register-auth.mjs'
import { registerAssinaturaRoutes } from './register-assinatura.mjs'
import { registerUsuarioPerfilRoutes } from './register-usuario-perfil.mjs'
import { registerTransacoesRoutes } from './register-transacoes.mjs'
import { registerAgendaRoutes } from './register-agenda.mjs'
import { registerPagamentosRoutes } from './register-pagamentos.mjs'
import { registerAiRoutes } from './register-ai.mjs'
import { registerWhatsappRoutes } from './register-whatsapp.mjs'
import { registerFamiliaRoutes } from './register-familia.mjs'
import { registerInvestimentosRoutes } from './register-investimentos.mjs'
import { registerTaxaSelicRoutes } from './register-taxa-selic.mjs'
import { registerTaxaCdiRoutes } from './register-taxa-cdi.mjs'
import { registerListaComprasRoutes } from './register-lista-compras.mjs'
import { registerMetasRoutes } from './register-metas.mjs'
import { registerGamificacaoRoutes } from './register-gamificacao.mjs'
import { registerCartoesRoutes } from './register-cartoes.mjs'
import { registerInsightsRoutes } from './register-insights.mjs'
import { registerOnboardingRoutes } from './register-onboarding.mjs'
import { registerDigestRoutes } from './register-digest.mjs'
import { registerTrialRoutes } from './register-trial.mjs'
import { registerImportRoutes } from './register-import.mjs'
import { registerIaCronRoutes } from './register-ia-cron.mjs'

/** Regista todas as rotas `/api/*` (exceto health, montado em app.mjs). */
export function registerApiDomainRoutes(app) {
  registerTaxaSelicRoutes(app)
  registerTaxaCdiRoutes(app)
  registerAuthRoutes(app)
  registerAssinaturaRoutes(app)
  registerUsuarioPerfilRoutes(app)
  registerTransacoesRoutes(app)
  registerAgendaRoutes(app)
  registerPagamentosRoutes(app)
  registerAiRoutes(app)
  registerWhatsappRoutes(app)
  registerFamiliaRoutes(app)
  registerInvestimentosRoutes(app)
  registerListaComprasRoutes(app)
  registerMetasRoutes(app)
  registerGamificacaoRoutes(app)
  registerCartoesRoutes(app)
  registerInsightsRoutes(app)
  registerOnboardingRoutes(app)
  registerDigestRoutes(app)
  registerTrialRoutes(app)
  registerImportRoutes(app)
  registerIaCronRoutes(app)
}
