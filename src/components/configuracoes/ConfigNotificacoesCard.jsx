// Card "Notificações" das Configurações — lista de toggles de preferências WhatsApp.
// Extraído de pages/Configuracoes.jsx (relocação pura).

const PREF_NOTIF = [
  { key: 'notif_lembretes', label: 'Lembretes de agenda', desc: 'Avisos de compromissos no WhatsApp' },
  { key: 'notif_alertas', label: 'Alertas financeiros', desc: 'Gasto alto e estouro de orçamento' },
  { key: 'notif_digest', label: 'Resumo semanal/mensal', desc: 'Digest das suas finanças' },
  { key: 'notif_novidades', label: 'Novidades e dicas', desc: 'Comunicados do Severino' },
]

export default function ConfigNotificacoesCard({ prefs, prefsSaving, onToggle }) {
  const prefVal = (k) => prefs[k] !== false // default: ativado
  return (
    <section className="config-card config-card--full" id="config-secao-notificacoes">
      <div className="config-card-head">
        <span className="config-card-kicker">Notificações</span>
        <h2 className="config-card-title-clean">O que você recebe no WhatsApp</h2>
        <p className="config-card-subtitle">Escolha quais mensagens o Severino envia para você.</p>
      </div>
      <div className="config-preference-list">
        {PREF_NOTIF.map((p) => (
          <label key={p.key} className="config-pref-row config-pref-row--clean">
            <span className="config-pref-label">
              {p.label}
              <small className="config-pref-desc">{p.desc}</small>
            </span>
            <input
              type="checkbox"
              className="switch-apple"
              checked={prefVal(p.key)}
              disabled={prefsSaving === p.key}
              onChange={(e) => void onToggle(p.key, e.target.checked)}
            />
          </label>
        ))}
      </div>
    </section>
  )
}
