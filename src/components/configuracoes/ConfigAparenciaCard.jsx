import React from 'react'

export default function ConfigAparenciaCard({ theme, themePref, setTheme, privacyMode, togglePrivacy, id }) {
  const autoOn = themePref === 'system'
  return (
    <section id={id} className="config-card config-card--preferences" aria-labelledby="config-preferencias-heading">
      <div className="config-card-head">
        <span className="config-card-kicker">Preferências</span>
        <h2 id="config-preferencias-heading" className="config-card-title-clean">
          Aparência
        </h2>
        <p className="config-card-subtitle">Escolha o tema e o nível de privacidade da interface.</p>
      </div>

      <div className="config-preference-list">
        <div className="config-pref-row config-pref-row--clean">
          <span className="config-pref-label">
            <strong>Tema</strong>
            <span>
              {autoOn
                ? `Seguindo o sistema (${theme === 'dark' ? 'escuro' : 'claro'}).`
                : theme === 'dark' ? 'Modo escuro ativo.' : 'Modo claro ativo.'}
            </span>
          </span>
          <button
            type="button"
            className={`config-theme-switch ${theme === 'dark' ? 'is-dark' : ''}`}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Alternar entre tema claro e escuro"
            disabled={autoOn}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <span className="config-theme-switch__thumb" aria-hidden="true">
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              )}
            </span>
          </button>
        </div>

        <label className="config-pref-row config-pref-row--clean">
          <span className="config-pref-label">
            <strong>Seguir o sistema</strong>
            <span>Usa o tema claro/escuro do seu aparelho automaticamente.</span>
          </span>
          <input
            type="checkbox"
            className="switch-apple"
            checked={autoOn}
            onChange={() => setTheme(autoOn ? theme : 'system')}
            aria-label="Seguir o tema do sistema"
          />
        </label>

        <label className="config-pref-row config-pref-row--clean">
          <span className="config-pref-label">
            <strong>Modo privacidade</strong>
            <span>Oculta valores sensíveis nas telas principais.</span>
          </span>
          <input
            type="checkbox"
            className="switch-apple"
            checked={privacyMode}
            onChange={togglePrivacy}
            aria-label="Modo privacidade"
          />
        </label>
      </div>
    </section>
  )
}
