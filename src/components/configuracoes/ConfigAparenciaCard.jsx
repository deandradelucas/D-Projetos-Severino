import React from 'react'

export default function ConfigAparenciaCard({ theme, setTheme, privacyMode, togglePrivacy }) {
  return (
    <section className="config-card config-card--preferences" aria-labelledby="config-preferencias-heading">
      <div className="config-card-head">
        <span className="config-card-kicker">Preferências</span>
        <h2 id="config-preferencias-heading" className="config-card-title-clean">
          Aparência
        </h2>
        <p className="config-card-subtitle">Escolha o tema e o nível de privacidade da interface.</p>
      </div>

      <div className="config-themes config-themes--compact" role="group" aria-label="Tema da interface">
        <button
          type="button"
          className={`config-theme-card ${theme === 'light' ? 'is-active' : ''}`}
          onClick={() => setTheme('light')}
          aria-pressed={theme === 'light'}
        >
          <div className="config-theme-preview config-theme-preview--light" aria-hidden />
          <div className="config-theme-body">
            <h4>Claro</h4>
            <p>Visual leve para o dia.</p>
          </div>
        </button>
        <button
          type="button"
          className={`config-theme-card ${theme === 'dark' ? 'is-active' : ''}`}
          onClick={() => setTheme('dark')}
          aria-pressed={theme === 'dark'}
        >
          <div className="config-theme-preview config-theme-preview--dark" aria-hidden />
          <div className="config-theme-body">
            <h4>Escuro</h4>
            <p>Menos brilho à noite.</p>
          </div>
        </button>
      </div>

      <div className="config-preference-list">
        <label className="config-pref-row config-pref-row--clean">
          <span className="config-pref-label">
            <strong>Modo privacidade</strong>
            <span>Oculta valores sensíveis nas telas principais.</span>
          </span>
          <input type="checkbox" className="switch-apple" checked={privacyMode} onChange={togglePrivacy} aria-label="Modo privacidade" />
        </label>
      </div>
    </section>
  )
}
