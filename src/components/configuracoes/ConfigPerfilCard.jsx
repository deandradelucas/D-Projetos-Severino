import { maskPhoneBRMobile } from '../../lib/formatPhoneBR'

// Card "Conta" (perfil) das Configurações — avatar, nome, e-mail, verificações,
// telefone e vínculo familiar. Extraído de pages/Configuracoes.jsx (relocação pura).
export default function ConfigPerfilCard({
  perfil,
  avatarSaving,
  fileInputRef,
  removerFoto,
  handleAvatarFile,
  nomeEditando,
  nomeInput,
  setNomeInput,
  nomeSaving,
  salvarNome,
  setNomeEditando,
  telefoneLabel,
  usuarioIdHeader,
  abrirEditarTelefone,
  familiaBusy,
  setFamiliaConfirm,
  telefoneEditando,
  telefoneInput,
  setTelefoneInput,
  telefoneSaving,
  salvarTelefone,
  cancelarEditarTelefone,
  verif,
  verifCooldown = 0,
  onVerificar,
  onConfirmarVerif,
  onReenviarVerif,
  onCancelarVerif,
  onVerifCodigo,
}) {
  return (
    <section className="config-card config-profile-card" id="config-secao-conta">
      <div className="config-profile-main">
        <div className="config-profile-avatar-wrap">
          <button
            type="button"
            className="config-profile-avatar config-profile-avatar--btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarSaving}
            aria-label="Alterar foto de perfil"
            title="Alterar foto de perfil"
          >
            {perfil.avatar_url ? (
              <img src={perfil.avatar_url} alt="" className="config-profile-avatar__img" />
            ) : (
              <span className="config-profile-avatar__initials">
                {String(perfil.nome || 'U').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
              </span>
            )}
            <span className="config-profile-avatar__cam" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </span>
          </button>
          {perfil.avatar_url && (
            <button
              type="button"
              className="config-profile-avatar__remove"
              onClick={removerFoto}
              disabled={avatarSaving}
              aria-label="Remover foto"
              title="Remover foto"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarFile} />
        </div>
        <div className="config-profile-copy">
          <span className="config-card-kicker">Conta</span>
          {nomeEditando ? (
            <div className="config-nome-edit">
              <input
                className="config-input"
                value={nomeInput}
                onChange={(e) => setNomeInput(e.target.value)}
                maxLength={80}
                placeholder="Seu nome"
                disabled={nomeSaving}
                autoFocus
              />
              <button type="button" className="config-action-btn config-action-btn--primary" onClick={() => void salvarNome()} disabled={nomeSaving}>
                {nomeSaving ? '…' : 'Salvar'}
              </button>
              <button type="button" className="config-action-btn" onClick={() => setNomeEditando(false)} disabled={nomeSaving}>
                Cancelar
              </button>
            </div>
          ) : (
            <h2 className="config-profile-name">
              {perfil.nome || 'Usuário'}
              <button
                type="button"
                className="config-nome-edit-btn"
                onClick={() => { setNomeInput(perfil.nome || ''); setNomeEditando(true) }}
                aria-label="Editar nome"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
            </h2>
          )}
          <p className="config-profile-email">{perfil.email || 'E-mail não informado'}</p>
          <div className="config-verif-chips">
            <span className={`config-verif-chip${perfil.email_verificado ? ' config-verif-chip--ok' : ' config-verif-chip--pendente'}`}>
              {perfil.email_verificado ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              )}
              E-mail {perfil.email_verificado ? 'verificado' : 'não verificado'}
            </span>
            {!perfil.email_verificado ? (
              <button type="button" className="config-verif-action" onClick={() => onVerificar?.('email')} disabled={verif?.busy}>
                Verificar agora
              </button>
            ) : null}
            <span className={`config-verif-chip${perfil.telefone_verificado ? ' config-verif-chip--ok' : ' config-verif-chip--pendente'}`}>
              {perfil.telefone_verificado ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              )}
              Telefone {perfil.telefone_verificado ? 'verificado' : 'não verificado'}
            </span>
            {!perfil.telefone_verificado && perfil.telefone ? (
              <button type="button" className="config-verif-action" onClick={() => onVerificar?.('telefone')} disabled={verif?.busy}>
                Verificar agora
              </button>
            ) : null}
          </div>
          {perfil.created_at ? (
            <p className="config-profile-since">
              Membro desde {new Date(perfil.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          ) : null}
        </div>
      </div>

      {verif?.canal ? (
        <div className="config-verif-panel" role="group" aria-label="Confirmar código de verificação">
          <p className="config-verif-panel__lead">
            {verif.canal === 'email'
              ? `Enviamos um código para ${verif.destino || 'seu e-mail'}. Digite os 6 dígitos abaixo.`
              : 'Enviamos um código pelo seu WhatsApp. Digite os 6 dígitos abaixo.'}
          </p>
          <div className="config-verif-panel__row">
            <input
              className="config-input config-input--compact config-verif-panel__input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verif.codigo}
              onChange={(e) => onVerifCodigo?.(e.target.value)}
              placeholder="000000"
              disabled={verif.busy}
              aria-label="Código de verificação"
            />
            <button
              type="button"
              className="config-action-btn config-action-btn--primary"
              onClick={() => onConfirmarVerif?.()}
              disabled={verif.busy || verif.codigo.length !== 6}
            >
              {verif.busy ? '…' : 'Confirmar'}
            </button>
          </div>
          {verif.erro ? <p className="config-verif-panel__err">{verif.erro}</p> : null}
          <div className="config-verif-panel__actions">
            <button type="button" className="config-nome-edit-btn" onClick={() => onReenviarVerif?.()} disabled={verif.busy || verifCooldown > 0}>
              {verifCooldown > 0 ? `Reenviar código (${verifCooldown}s)` : 'Reenviar código'}
            </button>
            <button type="button" className="config-nome-edit-btn" onClick={() => onCancelarVerif?.()} disabled={verif.busy}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="config-field-grid config-field-grid--single" aria-label="Dados do perfil">
        <div className="config-field config-field--with-action">
          <span>Telefone</span>
          <div className="config-field__value-row">
            <strong>{telefoneLabel}</strong>
            <button
              type="button"
              className="config-action-btn config-action-btn--inline"
              onClick={abrirEditarTelefone}
              disabled={!usuarioIdHeader}
            >
              {perfil.telefone ? 'Alterar' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </div>

      {perfil.conta_familiar_membro ? (
        <div className="config-membro-familia-row">
          <p className="config-membro-familia-text">
            Membro Familiar de:{' '}
            <strong className="config-membro-familia-nome">
              {String(perfil.conta_familiar_titular_nome || '').trim() || 'Titular'}
            </strong>
          </p>
          <button
            type="button"
            className="config-action-btn config-membro-familia-sair"
            disabled={familiaBusy}
            onClick={() => setFamiliaConfirm({ type: 'sair' })}
          >
            Sair
          </button>
        </div>
      ) : null}

      {telefoneEditando ? (
        <div className="config-telefone-form" aria-label="Alterar telefone">
          <label className="config-field config-field--stretch" htmlFor="config-telefone-input">
            <span>Celular (WhatsApp)</span>
            <input
              id="config-telefone-input"
              type="tel"
              className="config-input"
              value={telefoneInput}
              onChange={(e) => setTelefoneInput(maskPhoneBRMobile(e.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={15}
              autoComplete="tel"
              inputMode="numeric"
              disabled={telefoneSaving}
            />
          </label>
          <p className="config-telefone-form__hint">
            Usado pelo assistente no WhatsApp. Para trocar a senha, use Esqueceu a senha? na tela de login.
          </p>
          <div className="config-telefone-form__actions">
            <button
              type="button"
              className="config-action-btn config-action-btn--primary"
              disabled={telefoneSaving}
              onClick={() => void salvarTelefone()}
            >
              {telefoneSaving ? 'Salvando…' : 'Salvar telefone'}
            </button>
            <button
              type="button"
              className="config-action-btn"
              disabled={telefoneSaving}
              onClick={cancelarEditarTelefone}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

    </section>
  )
}
