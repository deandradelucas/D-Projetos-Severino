import React, { useCallback, useEffect, useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import InvestimentoNovoModal from '../components/investimentos/InvestimentoNovoModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import TaxaSelicBadge from '../components/TaxaSelicBadge.jsx'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'
import { redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'
import { INVESTIMENTOS_PRESETS_LIST } from '../lib/investimentosPresets'

function labelTipoInvestimentoPreset(key) {
  if (key == null || String(key).trim() === '') return null
  const k = String(key).toUpperCase()
  return INVESTIMENTOS_PRESETS_LIST.find((p) => p.key === k)?.label || k
}

export default function Investimentos() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalResetKey, setModalResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)

  const session = readHorizonteUser()
  const uid = session?.id ? String(session.id).trim() : ''

  const carregar = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/investimentos'), {
        headers: { 'x-user-id': uid },
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Não foi possível carregar os investimentos.')
      }
      const data = await res.json()
      setLista(Array.isArray(data) ? data : [])
    } catch (e) {
      showToast(e.message || 'Erro ao carregar investimentos.', 'error')
      setLista([])
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const handleAdicionar = async (payload) => {
    if (!uid) return
    setSubmitting(true)
    try {
      const res = await fetch(apiUrl('/api/investimentos'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': uid,
        },
        body: JSON.stringify(payload),
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Não foi possível adicionar.')
      showToast('Investimento adicionado.')
      setModalOpen(false)
      await carregar()
    } catch (e) {
      showToast(e.message || 'Erro ao adicionar.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmarRemover = async () => {
    if (!uid || !removeTarget?.id) return
    try {
      const res = await fetch(apiUrl(`/api/investimentos/${removeTarget.id}`), {
        method: 'DELETE',
        headers: { 'x-user-id': uid },
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      const errBody = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errBody.message || 'Não foi possível remover.')
      showToast('Investimento removido.')
      setRemoveTarget(null)
      await carregar()
    } catch (e) {
      showToast(e.message || 'Erro ao remover.', 'error')
    }
  }

  const formatData = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className="dashboard-container page-investimentos ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
              <section className="dashboard-hub__hero page-investimentos-hero" aria-label="Investimentos">
                <div className="dashboard-hub__hero-row page-investimentos-hero__row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} aria-label="Abrir menu" />
                  <div className="dashboard-hub__hero-text page-investimentos-hero__text">
                    <h1 className="dashboard-hub__title">Investimentos</h1>
                    <p className="ref-panel__subtitle page-investimentos-hero__sub">
                      Custódia, tipo de aplicação e referência da Selic
                    </p>
                    <div className="page-investimentos-hero__selic">
                      <TaxaSelicBadge variant="hero" />
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions page-investimentos-hero__actions" role="toolbar" aria-label="Ações">
                    <button
                      type="button"
                      className="dashboard-hub__btn dashboard-hub__btn--primary"
                      onClick={() => {
                        setModalResetKey((k) => k + 1)
                        setModalOpen(true)
                      }}
                      disabled={!uid}
                    >
                      + Novo investimento
                    </button>
                  </div>
                </div>
              </section>

              <div className="page-investimentos-list">
                <article className="ref-panel page-investimentos-panel" aria-labelledby="inv-panel-title">
                  <div className="ref-panel__head page-investimentos-panel__head">
                    <div>
                      <h2 id="inv-panel-title" className="ref-panel__title">
                        A sua carteira
                      </h2>
                      <p className="ref-panel__subtitle">Instituição e tipo que indicou no cadastro</p>
                    </div>
                    {!loading && lista.length > 0 ? (
                      <span className="page-investimentos-panel__count" aria-label={`${lista.length} itens`}>
                        {lista.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="page-investimentos-panel__body">
                    {loading ? (
                      <div className="page-investimentos-skeleton" aria-hidden>
                        <div className="page-investimentos-skeleton__row" />
                        <div className="page-investimentos-skeleton__row" />
                        <div className="page-investimentos-skeleton__row page-investimentos-skeleton__row--short" />
                      </div>
                    ) : lista.length === 0 ? (
                      <div className="page-investimentos-empty-state" role="status">
                        <p className="page-investimentos-empty-state__title">Nada por aqui ainda</p>
                        <p className="page-investimentos-empty-state__text">
                          Registe o banco ou corretora e o tipo (LCA, CDB, etc.) para organizar a sua carteira.
                        </p>
                      </div>
                    ) : (
                      <ul className="page-investimentos-cards">
                        {lista.map((row) => {
                          const tipoLb = labelTipoInvestimentoPreset(row.tipo_preset)
                          return (
                            <li key={row.id}>
                              <article className="page-investimentos-card">
                                <div className="page-investimentos-card__main">
                                  <div className="page-investimentos-card__badges" aria-label="Etiquetas">
                                    <span className="page-investimentos-chip page-investimentos-chip--inst">
                                      {row.instituicao_nome || '—'}
                                    </span>
                                    {tipoLb ? (
                                      <span className="page-investimentos-chip page-investimentos-chip--tipo">{tipoLb}</span>
                                    ) : (
                                      <span className="page-investimentos-chip page-investimentos-chip--custom">
                                        Personalizado
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="page-investimentos-card__title">{row.nome}</h3>
                                  <p className="page-investimentos-card__meta">
                                    <span className="page-investimentos-card__date-label">Registado em</span>{' '}
                                    <time dateTime={row.criado_em || undefined}>{formatData(row.criado_em)}</time>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="page-investimentos-card__remove"
                                  onClick={() => setRemoveTarget({ id: row.id, nome: row.nome })}
                                >
                                  Remover
                                </button>
                              </article>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </article>
              </div>
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      <InvestimentoNovoModal
        key={modalResetKey}
        open={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        onSubmit={handleAdicionar}
        submitting={submitting}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remover investimento?"
        message={
          removeTarget
            ? `Remove "${removeTarget.nome}" da sua lista. Pode voltar a adicionar quando quiser.`
            : ''
        }
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        tone="danger"
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmarRemover}
      />
    </div>
  )
}
