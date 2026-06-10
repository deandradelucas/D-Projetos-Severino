import React from 'react'
import { webAuthnSupported } from '../../lib/webauthnBrowser'

export default function ConfigBiometriaCard({
  usuarioIdHeader,
  webauthnList,
  webauthnLoading,
  webauthnError,
  bioRegistering,
  handleRegisterBiometric,
  setConfirmBiometricRemoval,
  loadWebAuthn,
  id,
}) {
  const biometricSupported = webAuthnSupported()

  return (
    <section id={id} className="config-card config-card--full config-security-card">
      <div className="config-card-head config-card-head--row">
        <div>
          <span className="config-card-kicker">Segurança</span>
          <h2 className="config-card-title-clean">Login por biometria</h2>
          <p className="config-card-subtitle">Use digital ou Face ID neste aparelho quando disponível.</p>
        </div>
        <button
          type="button"
          className="config-action-btn config-action-btn--primary"
          disabled={!usuarioIdHeader || bioRegistering || !biometricSupported}
          onClick={handleRegisterBiometric}
          title={!biometricSupported ? 'Disponível só em conexão segura (HTTPS)' : undefined}
        >
          {bioRegistering ? 'Ativando…' : 'Ativar'}
        </button>
      </div>

      {!biometricSupported ? (
        <p className="config-bio-unsupported">
          A biometria só funciona em <strong>conexão segura (HTTPS)</strong> ou em <strong>localhost</strong>. No app publicado funciona normalmente; ao abrir pelo IP da rede (http://…) o navegador bloqueia por segurança.
        </p>
      ) : null}

      <div className="config-security-panel">
        {webauthnLoading ? (
          <ul className="config-bio-list" aria-busy="true" aria-label="Carregando dispositivos">
            <li className="config-skeleton-row" />
            <li className="config-skeleton-row" />
          </ul>
        ) : webauthnError ? (
          <div className="config-empty-note">
            <span>{webauthnError}</span>
            <button type="button" className="config-action-btn" onClick={() => loadWebAuthn()}>
              Tentar de novo
            </button>
          </div>
        ) : webauthnList.length === 0 ? (
          <p className="config-empty-note">
            Nenhuma biometria cadastrada nesta conta.
          </p>
        ) : (
          <ul className="config-bio-list">
            {webauthnList.map((row) => (
              <li key={row.id} className="config-bio-item">
                <span>
                  <strong>{row.friendly_name || 'Dispositivo'}</strong>
                  <small>
                    {row.created_at
                      ? `Cadastrado em ${new Date(row.created_at).toLocaleDateString('pt-BR', { dateStyle: 'short' })}`
                      : 'Cadastrado'}
                    {row.last_used_at
                      ? ` · último uso ${new Date(row.last_used_at).toLocaleDateString('pt-BR', { dateStyle: 'short' })}`
                      : ''}
                  </small>
                </span>
                <button type="button" className="config-action-btn" onClick={() => setConfirmBiometricRemoval(row.id)}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
