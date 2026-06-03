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
        >
          {bioRegistering ? 'Ativando…' : 'Ativar'}
        </button>
      </div>

      <div className="config-security-panel">
        {webauthnLoading ? (
          <p className="config-empty-note">Carregando dispositivos…</p>
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
                  <strong>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                      : 'Dispositivo cadastrado'}
                  </strong>
                  {row.last_used_at ? (
                    <small>
                      Último uso: {new Date(row.last_used_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </small>
                  ) : null}
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
