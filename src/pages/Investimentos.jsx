import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import InvestimentoNovoModal from '../components/investimentos/InvestimentoNovoModal.jsx'
import InvestimentoAporteModal from '../components/investimentos/InvestimentoAporteModal.jsx'
import InvestimentoAportesDetalheModal from '../components/investimentos/InvestimentoAportesDetalheModal.jsx'
import InvestimentosResumo from '../components/investimentos/InvestimentosResumo.jsx'
import InvestimentoCard from '../components/investimentos/InvestimentoCard.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import TaxaSelicBadge from '../components/TaxaSelicBadge.jsx'
import TaxaCdiBadge from '../components/TaxaCdiBadge.jsx'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'
import { redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'
import { INVESTIMENTOS_PRESETS_LIST } from '../lib/investimentosPresets'
import { fetchTaxaCdiDeduplicated } from '../lib/taxaCdiClient'
import {
  IR_RENDA_FIXA_REGRESSIVO_UI,
  ehDiaUtilComPregaoCdi,
  extrairYyyyMmDdReferencia,
} from '../lib/investimentosRendimentoIr'

function buildOptimisticItem(payload, uid, id) {
  const presetKey = String(payload.preset ?? '').trim().toUpperCase()
  const presetObj = INVESTIMENTOS_PRESETS_LIST.find((p) => p.key === presetKey)
  const nome = presetObj ? presetObj.label : String(payload.nome_custom ?? '').trim()
  return {
    id,
    usuario_id: uid,
    tipo_preset: presetObj ? presetKey : null,
    nome,
    instituicao_nome: String(payload.instituicao_nome ?? '').trim(),
    valor_investido: Number(payload.valor_investido),
    percentual_cdi: Number(payload.percentual_cdi),
    data_aquisicao: payload.data_aquisicao ?? null,
    data_vencimento: payload.data_vencimento ?? null,
    criado_em: new Date().toISOString(),
    tipo_indexador: payload.tipo_indexador ?? 'CDI',
    aportes: [],
  }
}

export default function Investimentos() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalResetKey, setModalResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [irTabelaExpandida, setIrTabelaExpandida] = useState(false)
  const [cdiAa, setCdiAa] = useState(null)
  const [cdiLoading, setCdiLoading] = useState(true)
  const [sortKey, setSortKey] = useState('data_desc')
  const [filtroPreset, setFiltroPreset] = useState('')

  // Aportes state
  const [aporteTarget, setAporteTarget] = useState(null)
  const [aporteSubmitting, setAporteSubmitting] = useState(false)
  const [aporteDetalheTarget, setAporteDetalheTarget] = useState(null)
  const [removendoAporteId, setRemovendoAporteId] = useState(null)

  const session = readHorizonteUser()
  const uid = session?.id ? String(session.id).trim() : ''
  const pregaoCdiHoje = ehDiaUtilComPregaoCdi()

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

  useEffect(() => {
    let cancelled = false
    fetchTaxaCdiDeduplicated()
      .then((data) => {
        if (cancelled) return
        const v = Number(data?.valor_aa)
        setCdiAa(Number.isFinite(v) ? v : null)
      })
      .catch(() => {
        if (cancelled) return
        setCdiAa(null)
      })
      .finally(() => {
        if (!cancelled) setCdiLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const carteiraTotalInvestido = useMemo(() => {
    let t = 0
    for (const row of lista) {
      const v = Number(row.valor_investido)
      if (Number.isFinite(v) && v > 0) t += v
    }
    return t
  }, [lista])

  const tiposNaLista = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const row of lista) {
      const k = String(row.tipo_preset ?? '').trim().toUpperCase()
      if (k && !seen.has(k)) {
        seen.add(k)
        result.push(k)
      }
    }
    return result
  }, [lista])

  const listaExibicao = useMemo(() => {
    let l = filtroPreset
      ? lista.filter((r) => String(r.tipo_preset ?? '').trim().toUpperCase() === filtroPreset)
      : [...lista]
    l.sort((a, b) => {
      switch (sortKey) {
        case 'valor_desc':
          return (Number(b.valor_investido) || 0) - (Number(a.valor_investido) || 0)
        case 'valor_asc':
          return (Number(a.valor_investido) || 0) - (Number(b.valor_investido) || 0)
        case 'nome_asc':
          return String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR')
        case 'data_asc': {
          const da = extrairYyyyMmDdReferencia(a.data_aquisicao) ?? extrairYyyyMmDdReferencia(a.criado_em) ?? ''
          const db = extrairYyyyMmDdReferencia(b.data_aquisicao) ?? extrairYyyyMmDdReferencia(b.criado_em) ?? ''
          return da.localeCompare(db)
        }
        default: {
          const da = extrairYyyyMmDdReferencia(a.data_aquisicao) ?? extrairYyyyMmDdReferencia(a.criado_em) ?? ''
          const db = extrairYyyyMmDdReferencia(b.data_aquisicao) ?? extrairYyyyMmDdReferencia(b.criado_em) ?? ''
          return db.localeCompare(da)
        }
      }
    })
    return l
  }, [lista, sortKey, filtroPreset])

  const handleSalvarInvestimento = async (payload) => {
    if (!uid) return
    const editingId = editTarget?.id ? String(editTarget.id).trim() : ''
    const prevItem = editingId ? lista.find((x) => x.id === editingId) ?? null : null
    const tempId = `__opt__${Date.now()}`
    const optimistic = buildOptimisticItem(payload, uid, editingId || tempId)

    setModalOpen(false)
    setEditTarget(null)
    if (editingId) {
      setLista((prev) => prev.map((x) => (x.id === editingId ? optimistic : x)))
    } else {
      setLista((prev) => [optimistic, ...prev])
    }

    setSubmitting(true)
    try {
      const res = await fetch(apiUrl(editingId ? `/api/investimentos/${editingId}` : '/api/investimentos'), {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': uid },
        body: JSON.stringify(payload),
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || (editingId ? 'Não foi possível atualizar.' : 'Não foi possível adicionar.'))
      if (editingId) {
        setLista((prev) => prev.map((x) => (x.id === editingId ? data : x)))
      } else {
        setLista((prev) => [data, ...prev.filter((x) => x.id !== tempId)])
      }
      showToast(editingId ? 'Investimento atualizado.' : 'Investimento adicionado.')
    } catch (e) {
      if (editingId && prevItem) {
        setLista((prev) => prev.map((x) => (x.id === editingId ? prevItem : x)))
      } else {
        setLista((prev) => prev.filter((x) => x.id !== tempId))
      }
      showToast(e.message || (editingId ? 'Erro ao atualizar.' : 'Erro ao adicionar.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmarRemover = async () => {
    if (!uid || !removeTarget?.id) return
    const targetId = removeTarget.id
    const targetItem = lista.find((x) => x.id === targetId) ?? null

    setRemoveTarget(null)
    setLista((prev) => prev.filter((x) => x.id !== targetId))

    try {
      const res = await fetch(apiUrl(`/api/investimentos/${targetId}`), {
        method: 'DELETE',
        headers: { 'x-user-id': uid },
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      const errBody = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errBody.message || 'Não foi possível remover.')
      showToast('Investimento removido.')
    } catch (e) {
      if (targetItem) setLista((prev) => [targetItem, ...prev])
      showToast(e.message || 'Erro ao remover.', 'error')
    }
  }

  const handleAportar = async (payload) => {
    if (!uid || !aporteTarget?.id) return
    setAporteSubmitting(true)
    try {
      const res = await fetch(apiUrl(`/api/investimentos/${aporteTarget.id}/aportes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': uid },
        body: JSON.stringify(payload),
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Não foi possível adicionar o aporte.')
      setLista((prev) => prev.map((x) => (x.id === aporteTarget.id ? data : x)))
      if (aporteDetalheTarget?.id === aporteTarget.id) setAporteDetalheTarget(data)
      setAporteTarget(null)
      showToast('Aporte adicionado.')
    } catch (e) {
      showToast(e.message || 'Erro ao adicionar aporte.', 'error')
    } finally {
      setAporteSubmitting(false)
    }
  }

  const handleRemoverAporte = async (investimentoId, aporteId) => {
    if (!uid) return
    setRemovendoAporteId(aporteId)
    try {
      const res = await fetch(apiUrl(`/api/investimentos/${investimentoId}/aportes/${aporteId}`), {
        method: 'DELETE',
        headers: { 'x-user-id': uid },
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Não foi possível remover o aporte.')
      setLista((prev) => prev.map((x) => (x.id === investimentoId ? data : x)))
      if (aporteDetalheTarget?.id === investimentoId) setAporteDetalheTarget(data)
      showToast('Aporte removido.')
    } catch (e) {
      showToast(e.message || 'Erro ao remover aporte.', 'error')
    } finally {
      setRemovendoAporteId(null)
    }
  }

  return (
    <div className="dashboard-container dashboard-page page-investimentos ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
              <section className="dashboard-hub__hero" aria-label="Investimentos">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} aria-label="Abrir menu" />
                  <div className="dashboard-hub__hero-text">
                    <h1 className="dashboard-hub__title">Investimentos</h1>
                    <div className="page-investimentos-hero__rates-row" aria-label="Taxas de referência BCB">
                      <TaxaSelicBadge variant="hero" />
                      <TaxaCdiBadge variant="hero" />
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Ações">
                    <button
                      type="button"
                      className="dashboard-hub__btn dashboard-hub__btn--primary"
                      onClick={() => {
                        setEditTarget(null)
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

              <section className="ref-bottom-grid ref-bottom-grid--single" aria-label="Investimentos registados">
                <InvestimentosResumo lista={lista} cdiAa={cdiAa} cdiLoading={cdiLoading} />

                <article
                  className="ref-panel ref-panel--transactions dashboard-hub__tx-panel page-investimentos-panel"
                  aria-labelledby="inv-panel-title"
                >
                  <div className="ref-panel__head page-investimentos-panel__head">
                    <div>
                      <h2 id="inv-panel-title" className="ref-panel__title">
                        A sua carteira
                      </h2>
                    </div>
                    {!loading && lista.length > 0 ? (
                      <span
                        className="page-investimentos-panel__count"
                        aria-label={filtroPreset && listaExibicao.length !== lista.length ? `${listaExibicao.length} de ${lista.length} itens` : `${lista.length} itens`}
                      >
                        {filtroPreset && listaExibicao.length !== lista.length ? `${listaExibicao.length}/${lista.length}` : lista.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="ref-tx-list page-investimentos-panel__list">
                    {!loading && lista.length > 1 ? (
                      <div className="page-investimentos-controls" aria-label="Ordenar e filtrar">
                        <select
                          className="page-investimentos-controls__select"
                          value={sortKey}
                          onChange={(e) => setSortKey(e.target.value)}
                          aria-label="Ordenar por"
                        >
                          <option value="data_desc">Mais recente primeiro</option>
                          <option value="data_asc">Mais antigo primeiro</option>
                          <option value="valor_desc">Maior valor primeiro</option>
                          <option value="valor_asc">Menor valor primeiro</option>
                          <option value="nome_asc">Nome (A–Z)</option>
                        </select>
                        {tiposNaLista.length > 1 ? (
                          <div className="page-investimentos-controls__filters" role="group" aria-label="Filtrar por tipo">
                            <button
                              type="button"
                              className={`page-investimentos-controls__filter-btn${filtroPreset === '' ? ' page-investimentos-controls__filter-btn--active' : ''}`}
                              onClick={() => setFiltroPreset('')}
                            >
                              Todos
                            </button>
                            {tiposNaLista.map((k) => {
                              const p = INVESTIMENTOS_PRESETS_LIST.find((x) => x.key === k)
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  className={`page-investimentos-controls__filter-btn${filtroPreset === k ? ' page-investimentos-controls__filter-btn--active' : ''}`}
                                  onClick={() => setFiltroPreset((v) => (v === k ? '' : k))}
                                >
                                  {p?.label ?? k}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {loading ? (
                      <div className="page-investimentos-skeleton" aria-hidden>
                        <div className="page-investimentos-skeleton__row" />
                        <div className="page-investimentos-skeleton__row" />
                        <div className="page-investimentos-skeleton__row page-investimentos-skeleton__row--short" />
                      </div>
                    ) : lista.length === 0 ? (
                      <div className="ref-empty-state page-investimentos-empty-state" role="status">
                        <p className="ref-empty">Nada por aqui ainda</p>
                        <p className="page-investimentos-empty-state__text">
                          Registe o banco ou corretora e o tipo (LCA, CDB, etc.) para organizar a sua carteira.
                        </p>
                      </div>
                    ) : listaExibicao.length === 0 ? (
                      <p className="page-investimentos-controls__empty">Nenhum resultado para esse filtro.</p>
                    ) : (
                      <ul className="page-investimentos-cards">
                        {listaExibicao.map((row) => (
                          <li key={row.id}>
                            <InvestimentoCard
                              row={row}
                              cdiAa={cdiAa}
                              cdiLoading={cdiLoading}
                              pregaoCdiHoje={pregaoCdiHoje}
                              uid={uid}
                              onEdit={(r) => { setEditTarget(r); setModalOpen(true) }}
                              onRemove={(target) => setRemoveTarget(target)}
                              onAportar={(r) => setAporteTarget(r)}
                              onVerAportes={(r) => setAporteDetalheTarget(r)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>

                <article
                  className={`ref-panel dashboard-hub__tx-panel page-investimentos-ir-panel${irTabelaExpandida ? ' page-investimentos-ir-panel--expanded' : ' page-investimentos-ir-panel--collapsed'}`}
                  aria-labelledby="inv-ir-title"
                >
                  <div className="ref-panel__head page-investimentos-ir-panel__head">
                    <h2 className="page-investimentos-ir-panel__heading">
                      <button
                        type="button"
                        id="inv-ir-toggle"
                        className="page-investimentos-ir-panel__toggle"
                        aria-expanded={irTabelaExpandida}
                        aria-controls="inv-ir-details"
                        onClick={() => setIrTabelaExpandida((v) => !v)}
                      >
                        <span className="page-investimentos-ir-panel__toggle-text">
                          <span id="inv-ir-title" className="page-investimentos-ir-panel__toggle-title">
                            Imposto de renda na renda fixa
                          </span>
                          <span className="page-investimentos-ir-panel__toggle-desc">
                            {irTabelaExpandida
                              ? 'Alíquotas regressivas sobre o rendimento (referência — consulte regras vigentes)'
                              : 'Tabela regressiva 22,5%–15% · LCA e LCI isentos para PF'}
                          </span>
                        </span>
                        <span className="page-investimentos-ir-panel__chevron" aria-hidden>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="page-investimentos-ir-panel__chevron-svg"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                      </button>
                    </h2>
                  </div>
                  <div
                    id="inv-ir-details"
                    role="region"
                    aria-labelledby="inv-ir-toggle"
                    hidden={!irTabelaExpandida}
                    className="page-investimentos-ir-panel__body"
                  >
                    <div className="page-investimentos-ir-table-wrap" role="region" aria-label="Tabela regressiva de IR">
                      <table className="page-investimentos-ir-table">
                        <caption className="sr-only">
                          Alíquotas regressivas de IR sobre o rendimento em investimentos tributados (ex.: CDB)
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Prazo do investimento</th>
                            <th scope="col">Alíquota do IR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {IR_RENDA_FIXA_REGRESSIVO_UI.map((row) => (
                            <tr key={row.prazo}>
                              <td>{row.prazo}</td>
                              <td>
                                <span className="page-investimentos-ir-table__pct">{row.aliquota}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="page-investimentos-ir-isento" role="note">
                      <p className="page-investimentos-ir-isento__title">Isentos para pessoa física</p>
                      <p className="page-investimentos-ir-isento__text">
                        <strong>LCA</strong> e <strong>LCI</strong> não incidem IR sobre o rendimento para o investidor
                        pessoa física (regras da instituição e do produto podem variar).
                      </p>
                    </div>
                  </div>
                </article>
              </section>
            </RefDashboardScroll>
          </div>
        </main>
      </div>

      {!modalOpen && (
        <button
          type="button"
          className="dashboard-mobile-tx-fab"
          onClick={() => {
            setEditTarget(null)
            setModalResetKey((k) => k + 1)
            setModalOpen(true)
          }}
          disabled={!uid}
          aria-label="Criar novo investimento"
        >
          <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
          <span className="dashboard-mobile-tx-fab__label">Novo investimento</span>
        </button>
      )}

      <InvestimentoNovoModal
        key={editTarget?.id ?? `novo-${modalResetKey}`}
        open={modalOpen}
        initialEdit={editTarget}
        carteiraTotalInvestido={carteiraTotalInvestido}
        onClose={() => {
          if (!submitting) {
            setModalOpen(false)
            setEditTarget(null)
          }
        }}
        onSubmit={handleSalvarInvestimento}
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

      <InvestimentoAporteModal
        open={Boolean(aporteTarget)}
        onClose={() => { if (!aporteSubmitting) setAporteTarget(null) }}
        onSubmit={handleAportar}
        submitting={aporteSubmitting}
        investimentoNome={aporteTarget?.nome ?? ''}
      />

      <InvestimentoAportesDetalheModal
        open={Boolean(aporteDetalheTarget)}
        onClose={() => setAporteDetalheTarget(null)}
        investimento={aporteDetalheTarget}
        cdiAa={cdiAa}
        onRemoverAporte={handleRemoverAporte}
        removendoAporteId={removendoAporteId}
      />
    </div>
  )
}
