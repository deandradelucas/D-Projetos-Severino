import ConfigSelectCustom from '../ConfigSelectCustom.jsx'
import FamiliaConviteColarBlock from '../FamiliaConviteColarBlock'
import { showToast } from '../../lib/toastStore'
import { PAPEL_CONVITE_OPCOES, papelFamiliaLabel, papelTone, inicial } from '../../lib/familiaUi'

// Seção "Conta familiar" das Configurações — convite, membros, papéis.
// Extraída de pages/Configuracoes.jsx (relocação pura).
export default function ConfigFamiliaCard({
  perfil, usuarioIdHeader, refreshAssinaturaPerfil,
  familiaTitular, familiaMembros, familiaConvites, familiaBusy, familiaLoadErr,
  familiaVagasOcupadas, familiaLimiteConvitesAtingido, FAMILIA_MAX_VINCULADOS_UI,
  ultimoTokenConvite, conviteCopiadoVisivel, conviteQr, loginConviteHref,
  novoConvitePapel, setNovoConvitePapel,
  alterarPapelMembro, setAlterarPapelMembro,
  criarConviteFamilia, copiarConviteFamilia, compartilharWhatsApp, compartilharNativo,
  executarAlterarPapel, setFamiliaConfirm, loadFamiliaPainel,
}) {
  return (
          <div className="config-familia-group config-layout__full-span" id="config-secao-familia">
            {Boolean(usuarioIdHeader) && !perfil.conta_familiar_membro && familiaTitular !== true ? (
              <section className="config-card config-card--full" id="config-secao-convite-familia">
                <div className="config-card-head">
                  <span className="config-card-kicker">Família</span>
                  <h2 className="config-card-title-clean">Código de convite familiar</h2>
                  <p className="config-card-subtitle config-familia-intro">
                    Cole o link ou código que o titular enviou.
                  </p>
                </div>
                <FamiliaConviteColarBlock
                  idPrefix="config-familia-convite"
                  usuarioIdParaAceitar={usuarioIdHeader}
                  visualVariant="shell"
                  onAceitarSucesso={(data) => {
                    showToast(data?.message || 'Convite familiar aceito.')
                    void refreshAssinaturaPerfil()
                    void loadFamiliaPainel()
                  }}
                  onAceitarErro={(msg) => showToast(msg)}
                />
              </section>
            ) : null}

            {familiaTitular === true ? (
            <section className="config-card config-card--full config-familia-titular-card">
              <div className="config-card-head">
                <span className="config-card-kicker">Família</span>
                <h2 className="config-card-title-clean">Conta familiar</h2>
                <p className="config-card-subtitle config-familia-intro">
                  Convide até <strong>4 familiares</strong> (5 com você). Cada um entra com login próprio.
                </p>
              </div>

              {!perfil.conta_familiar_membro ? (
                <div className="config-subsection config-familia-convite-interno" id="config-secao-convite-familia">
                  <h3 className="config-subsection__title">Entrar em outra família</h3>
                  <p className="config-card-subtitle config-familia-intro">
                    Recebeu um convite? Cole o link ou código aqui.
                  </p>
                  <FamiliaConviteColarBlock
                    idPrefix="config-familia-convite-titular"
                    usuarioIdParaAceitar={usuarioIdHeader}
                    visualVariant="shell"
                    onAceitarSucesso={(data) => {
                      showToast(data?.message || 'Convite familiar aceito.')
                      void refreshAssinaturaPerfil()
                      void loadFamiliaPainel()
                    }}
                    onAceitarErro={(msg) => showToast(msg)}
                  />
                </div>
              ) : null}

              {familiaLoadErr ? <p className="config-empty-note">{familiaLoadErr}</p> : null}

              <p className="config-card-subtitle config-familia-vagas-line">
                {familiaVagasOcupadas === 0
                  ? 'Nenhum familiar vinculado ainda.'
                  : `${familiaVagasOcupadas} de ${FAMILIA_MAX_VINCULADOS_UI} vaga${familiaVagasOcupadas !== 1 ? 's' : ''} usada${familiaVagasOcupadas !== 1 ? 's' : ''} (membros + convites pendentes).`}
              </p>

              <div className="config-familia-generate-row">
                <label className="config-field config-field--stretch" htmlFor="familia-papel-convite">
                  <span>Papel do próximo convite</span>
                  <ConfigSelectCustom
                    id="familia-papel-convite"
                    value={novoConvitePapel}
                    onChange={setNovoConvitePapel}
                    options={PAPEL_CONVITE_OPCOES}
                    disabled={familiaBusy}
                  />
                </label>
                <div className="config-familia-generate-row__cta">
                  <button
                    type="button"
                    className="config-action-btn config-action-btn--primary"
                    disabled={familiaBusy || !usuarioIdHeader || familiaLimiteConvitesAtingido}
                    onClick={() => void criarConviteFamilia()}
                  >
                    {familiaBusy ? 'Gerando…' : 'Gerar convite'}
                  </button>
                </div>
              </div>

              {familiaLimiteConvitesAtingido ? (
                <p className="config-empty-note config-familia-limite-note">
                  Limite de <strong>5 pessoas</strong> atingido. Remova um membro ou convite para gerar outro.
                </p>
              ) : null}

              {ultimoTokenConvite ? (
                <div className="config-invite-panel">
                  <div className="config-invite-grid">
                    {/* QR Code do link */}
                    {conviteQr ? (
                      <div className="config-invite-qr" aria-label="QR Code do convite">
                        <img src={conviteQr} alt="QR Code para entrar na família" width={140} height={140} />
                        <span className="config-invite-qr__hint">Aponte a câmera</span>
                      </div>
                    ) : null}

                    <div className="config-invite-share">
                      {/* WhatsApp — ação principal */}
                      <button type="button" className="config-share-wa" onClick={compartilharWhatsApp}>
                        <svg viewBox="0 0 32 32" width="20" height="20" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
                          <path d="M16.003 2.667C8.637 2.667 2.667 8.637 2.667 16c0 2.363.637 4.573 1.748 6.484L2.667 29.333l7.06-1.727A13.27 13.27 0 0 0 16.003 29.333C23.363 29.333 29.333 23.363 29.333 16S23.363 2.667 16.003 2.667Zm0 2.4c6.044 0 10.93 4.887 10.93 10.933 0 6.044-4.886 10.933-10.93 10.933a10.9 10.9 0 0 1-5.564-1.524l-.397-.24-4.19 1.025 1.063-3.99-.267-.413A10.9 10.9 0 0 1 5.073 16c0-6.046 4.886-10.933 10.93-10.933Zm-3.56 5.6c-.22 0-.577.083-.88.41-.303.328-1.156 1.13-1.156 2.754s1.183 3.196 1.348 3.418c.165.222 2.31 3.664 5.673 4.993 2.802 1.105 3.37.885 3.977.83.606-.055 1.954-.8 2.23-1.573.276-.772.276-1.434.193-1.572-.083-.138-.303-.22-.634-.386-.33-.165-1.954-.964-2.257-1.074-.303-.11-.524-.165-.744.165-.22.33-.855 1.074-1.047 1.295-.193.22-.386.248-.716.083-.33-.165-1.393-.514-2.654-1.637-.98-.875-1.642-1.956-1.835-2.287-.193-.33-.02-.51.145-.674.148-.148.33-.386.496-.578.165-.193.22-.33.33-.55.11-.22.055-.413-.028-.578-.083-.165-.73-1.8-1.018-2.463-.258-.613-.528-.556-.744-.566-.193-.01-.413-.01-.634-.01Z"/>
                        </svg>
                        Enviar pelo WhatsApp
                      </button>

                      <div className="config-invite-secondary">
                        {typeof navigator !== 'undefined' && navigator.share ? (
                          <button type="button" className="config-action-btn" onClick={() => void compartilharNativo()}>Compartilhar…</button>
                        ) : null}
                        {loginConviteHref ? (
                          <button type="button" className="config-action-btn" onClick={() => copiarConviteFamilia(loginConviteHref)}>Copiar link</button>
                        ) : null}
                        <button type="button" className="config-action-btn" onClick={() => copiarConviteFamilia(ultimoTokenConvite)}>Copiar código</button>
                      </div>

                      <p className="config-invite-code-line">
                        Código: <code>{ultimoTokenConvite}</code> · <span className="config-invite-code-warn">só aparece uma vez</span>
                      </p>
                    </div>
                  </div>
                  <p
                    className={`config-invite-copiado${conviteCopiadoVisivel ? ' config-invite-copiado--visible' : ''}`}
                    role="status"
                    aria-live="polite"
                  >
                    Copiado
                  </p>
                </div>
              ) : null}

              <div className="config-subsection config-subsection--flush-top">
                <div className="config-subsection__head">
                  <h3 className="config-subsection__title">Convites pendentes</h3>
                  {familiaConvites.length > 0 ? (
                    <button
                      type="button"
                      className="config-action-btn"
                      disabled={familiaBusy}
                      onClick={() => setFamiliaConfirm({ type: 'revoke_all' })}
                    >
                      Remover todos
                    </button>
                  ) : null}
                </div>
              {familiaConvites.length === 0 ? (
                <p className="config-empty-note">Nenhum convite ativo.</p>
              ) : (
                <ul className="config-bio-list">
                  {familiaConvites.map((c) => (
                    <li key={c.id} className="config-bio-item">
                      <span>
                        <strong>{papelFamiliaLabel(c.papel_convite)}</strong>
                        <small>
                          Expira em{' '}
                          {c.expires_at
                            ? new Date(c.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </small>
                      </span>
                      <button type="button" className="config-action-btn" onClick={() => setFamiliaConfirm({ type: 'revoke', id: c.id })}>
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              </div>

              <div className="config-subsection">
                <h3 className="config-subsection__title">Membros</h3>
              {familiaMembros.length === 0 ? (
                <p className="config-empty-note">Nenhum familiar vinculado ainda.</p>
              ) : (
                <ul className="config-bio-list config-familia-membros">
                  {familiaMembros.map((mem) => (
                    <li key={mem.id} className="config-bio-item config-familia-membro">
                      <span className="config-familia-membro__id">
                        <span className="config-familia-membro__avatar" aria-hidden>{inicial(mem.nome, mem.email)}</span>
                        <span className="config-familia-membro__txt">
                          <strong>
                            {mem.nome || mem.email || mem.id}
                            <span className={`config-papel-chip config-papel-chip--${papelTone(mem.familia_papel)}`}>
                              {papelFamiliaLabel(mem.familia_papel)}
                            </span>
                          </strong>
                          {mem.email ? <small>{mem.email}</small> : null}
                        </span>
                      </span>
                      <div className="config-bio-item__actions">
                        {alterarPapelMembro?.usuarioId === mem.id ? (
                          <>
                            <select
                              className="config-input config-input--compact"
                              value={alterarPapelMembro.novoPapel}
                              disabled={familiaBusy}
                              onChange={(e) => setAlterarPapelMembro((prev) => ({ ...prev, novoPapel: e.target.value }))}
                            >
                              {PAPEL_CONVITE_OPCOES.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="config-action-btn config-action-btn--primary"
                              disabled={familiaBusy || alterarPapelMembro.novoPapel === mem.familia_papel}
                              onClick={() => void executarAlterarPapel(mem.id, alterarPapelMembro.novoPapel)}
                            >
                              {familiaBusy ? 'Salvando…' : 'Salvar'}
                            </button>
                            <button
                              type="button"
                              className="config-action-btn"
                              onClick={() => setAlterarPapelMembro(null)}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="config-action-btn"
                              disabled={familiaBusy}
                              onClick={() => setAlterarPapelMembro({ usuarioId: mem.id, novoPapel: mem.familia_papel })}
                            >
                              Alterar papel
                            </button>
                            <button
                              type="button"
                              className="config-action-btn"
                              aria-label={`Remover ${mem.nome || mem.email} da família`}
                              onClick={() => setFamiliaConfirm({ type: 'remove', usuarioId: mem.id })}
                            >
                              Remover
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </section>
            ) : null}
          </div>
  )
}
