import React, { useCallback, useEffect, useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import InvestimentoNovoModal from '../components/investimentos/InvestimentoNovoModal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import TaxaSelicBadge from '../components/TaxaSelicBadge.jsx'
import TaxaCdiBadge from '../components/TaxaCdiBadge.jsx'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'
import { redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { formatPercentualCdiLista } from '../lib/percentualCdiInput'
import { INVESTIMENTOS_PRESETS_LIST } from '../lib/investimentosPresets'
import { fetchTaxaCdiDeduplicated } from '../lib/taxaCdiClient'
import {
  IR_RENDA_FIXA_REGRESSIVO_UI,
  contarDiasUteisComJurosDesdeIso,
  diasCorridosDesdeIso,
  ehDiaUtilComPregaoCdi,
  estimativaRendimentoAcumuladoAteHoje,
  estimativaRendimentoDiarioComIr,
  extrairYyyyMmDdReferencia,
  formatMoedaDiariaEstimativa,
  investimentoIsentoIrPessoaFisica,
} from '../lib/investimentosRendimentoIr'

function labelTipoInvestimentoPreset(key) {
  if (key == null || String(key).trim() === '') return null
  const k = String(key).toUpperCase()
  return INVESTIMENTOS_PRESETS_LIST.find((p) => p.key === k)?.label || k
}

function isoOuDataParaCalculoDias(dataAquisicao, criadoEm) {
  const da = extrairYyyyMmDdReferencia(dataAquisicao)
  if (da) return `${da}T12:00:00`
  const dc = extrairYyyyMmDdReferencia(criadoEm)
  if (dc) return `${dc}T12:00:00`
  return criadoEm
}

function formatDataAquisicaoCartao(raw) {
  const ymd = extrairYyyyMmDdReferencia(raw)
  if (!ymd) return '—'
  try {
    return new Date(`${ymd}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
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

  const handleSalvarInvestimento = async (payload) => {
    if (!uid) return
    const editingId = editTarget?.id ? String(editTarget.id).trim() : ''
    setSubmitting(true)
    try {
      const res = await fetch(apiUrl(editingId ? `/api/investimentos/${editingId}` : '/api/investimentos'), {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': uid,
        },
        body: JSON.stringify(payload),
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || (editingId ? 'Não foi possível atualizar.' : 'Não foi possível adicionar.'))
      showToast(editingId ? 'Investimento atualizado.' : 'Investimento adicionado.')
      setModalOpen(false)
      setEditTarget(null)
      await carregar()
    } catch (e) {
      showToast(e.message || (editingId ? 'Erro ao atualizar.' : 'Erro ao adicionar.'), 'error')
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
                      <span className="page-investimentos-panel__count" aria-label={`${lista.length} itens`}>
                        {lista.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="ref-tx-list page-investimentos-panel__list">
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
                    ) : (
                      <ul className="page-investimentos-cards">
                        {lista.map((row) => {
                          const tipoLb = labelTipoInvestimentoPreset(row.tipo_preset)
                          const temValor =
                            row.valor_investido != null && Number.isFinite(Number(row.valor_investido))
                          const percLista = formatPercentualCdiLista(row.percentual_cdi)
                          const percNum = Number(row.percentual_cdi)
                          const percOk = Number.isFinite(percNum) && percNum > 0
                          const isentoIr = investimentoIsentoIrPessoaFisica(row.tipo_preset)
                          const dataAquisicaoYmd = extrairYyyyMmDdReferencia(row.data_aquisicao)
                          const isoCalculoDias = isoOuDataParaCalculoDias(row.data_aquisicao, row.criado_em)
                          const diasRegisto = diasCorridosDesdeIso(isoCalculoDias)
                          const diasUteisComJuros = contarDiasUteisComJurosDesdeIso(isoCalculoDias)
                          const mostrarRendimento = temValor && percOk
                          const cdiDisponivel = !cdiLoading && cdiAa != null && Number.isFinite(cdiAa) && cdiAa > 0
                          const estRendimento = mostrarRendimento && cdiDisponivel
                            ? estimativaRendimentoDiarioComIr(
                                Number(row.valor_investido),
                                percNum,
                                cdiAa,
                                diasRegisto,
                                isentoIr,
                              )
                            : null
                          const estRendimentoExibicao =
                            estRendimento && !pregaoCdiHoje
                              ? { ...estRendimento, bruto: 0, imposto: 0, liquido: 0 }
                              : estRendimento
                          const estAcumulado = estRendimento
                            ? estimativaRendimentoAcumuladoAteHoje(
                                Number(row.valor_investido),
                                percNum,
                                cdiAa,
                                diasRegisto,
                                isentoIr,
                                diasUteisComJuros ?? 0,
                              )
                            : null
                          const nomeRow = String(row.nome ?? '').trim()
                          const tituloRedundanteComChipTipo =
                            tipoLb != null &&
                            nomeRow !== '' &&
                            nomeRow.toUpperCase() === String(tipoLb).trim().toUpperCase()
                          return (
                            <li key={row.id}>
                              <article
                                className="page-investimentos-card"
                                aria-label={
                                  tituloRedundanteComChipTipo
                                    ? `${row.instituicao_nome || 'Investimento'}, ${tipoLb}`
                                    : undefined
                                }
                              >
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
                                  {!tituloRedundanteComChipTipo ? (
                                    <h3 className="page-investimentos-card__title">{row.nome}</h3>
                                  ) : null}
                                  {temValor || percLista ? (
                                    <>
                                      <dl className="page-investimentos-card__metrics" aria-label="Detalhes do investimento">
                                        {mostrarRendimento && cdiDisponivel && !dataAquisicaoYmd ? (
                                          <div className="page-investimentos-card__metric page-investimentos-card__metric--span">
                                            <dt className="sr-only">Data de aquisição</dt>
                                            <dd className="page-investimentos-card__missing-date-banner" role="alert">
                                              Não há data de aquisição gravada neste investimento. Abra Editar, confira a data da compra e guarde — sem isso o período usa só o dia em que criou o registo e o acumulado pode ficar zerado ao fim de semana.
                                            </dd>
                                          </div>
                                        ) : null}
                                        {dataAquisicaoYmd ? (
                                          <div className="page-investimentos-card__metric page-investimentos-card__metric--span page-investimentos-card__metric--aquisicao">
                                            <dt className="page-investimentos-card__metric-label">Adquirido em</dt>
                                            <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--date">
                                              <time dateTime={dataAquisicaoYmd}>
                                                {formatDataAquisicaoCartao(row.data_aquisicao)}
                                              </time>
                                            </dd>
                                          </div>
                                        ) : null}
                                        {temValor ? (
                                          <div className="page-investimentos-card__metric">
                                            <dt className="page-investimentos-card__metric-label">Valor aplicado</dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              {formatCurrencyBRL(Number(row.valor_investido))}
                                            </dd>
                                          </div>
                                        ) : null}
                                        {percLista ? (
                                          <div className="page-investimentos-card__metric">
                                            <dt className="page-investimentos-card__metric-label">% do CDI contratada</dt>
                                            <dd className="page-investimentos-card__metric-value">{percLista}</dd>
                                          </div>
                                        ) : null}
                                        {mostrarRendimento && cdiLoading ? (
                                          <div className="page-investimentos-card__metric page-investimentos-card__metric--span">
                                            <dt className="page-investimentos-card__metric-label">Rendimento por dia útil (est.)</dt>
                                            <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--muted">
                                              A carregar taxa CDI…
                                            </dd>
                                          </div>
                                        ) : null}
                                        {mostrarRendimento && !cdiLoading && !cdiDisponivel ? (
                                          <div className="page-investimentos-card__metric page-investimentos-card__metric--span">
                                            <dt className="page-investimentos-card__metric-label">Rendimento por dia útil (est.)</dt>
                                            <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--muted">
                                              Indisponível (taxa CDI)
                                            </dd>
                                          </div>
                                        ) : null}
                                        {estRendimentoExibicao ? (
                                          <>
                                            <div className="page-investimentos-card__metric">
                                              <dt className="page-investimentos-card__metric-label">Rendimento bruto por dia útil (est.)</dt>
                                              <dd className="page-investimentos-card__metric-value">
                                                {formatMoedaDiariaEstimativa(estRendimentoExibicao.bruto)}
                                              </dd>
                                            </div>
                                            <div className="page-investimentos-card__metric">
                                              <dt className="page-investimentos-card__metric-label">IR sobre rendimento (est.)</dt>
                                              <dd className="page-investimentos-card__metric-value">
                                                {estRendimentoExibicao.isento ? (
                                                  <span className="page-investimentos-card__ir-isento">{estRendimentoExibicao.aliquotaFmt}</span>
                                                ) : (
                                                  <>
                                                    {formatMoedaDiariaEstimativa(estRendimentoExibicao.imposto)}
                                                    <span className="page-investimentos-card__metric-suffix">
                                                      {' '}
                                                      ({estRendimentoExibicao.aliquotaFmt})
                                                    </span>
                                                  </>
                                                )}
                                              </dd>
                                            </div>
                                            <div className="page-investimentos-card__metric">
                                              <dt className="page-investimentos-card__metric-label">Rendimento líquido por dia útil (est.)</dt>
                                              <dd className="page-investimentos-card__metric-value">
                                                {formatMoedaDiariaEstimativa(estRendimentoExibicao.liquido)}
                                              </dd>
                                            </div>
                                            {estAcumulado ? (
                                              <>
                                                <div className="page-investimentos-card__metric">
                                                  <dt className="page-investimentos-card__metric-label">Rendimento bruto acumulado (est.)</dt>
                                                  <dd
                                                    className="page-investimentos-card__metric-value"
                                                    title={`~${estAcumulado.diasUteisAcumulacao} dias úteis com pregão desde a data de referência`}
                                                  >
                                                    {formatCurrencyBRL(estAcumulado.brutoAcumulado)}
                                                  </dd>
                                                </div>
                                                <div className="page-investimentos-card__metric">
                                                  <dt className="page-investimentos-card__metric-label">IR acumulado (est.)</dt>
                                                  <dd className="page-investimentos-card__metric-value">
                                                    {estAcumulado.isento ? (
                                                      <span className="page-investimentos-card__ir-isento">{estAcumulado.aliquotaFmt}</span>
                                                    ) : (
                                                      <>
                                                        {formatCurrencyBRL(estAcumulado.impostoAcumulado)}
                                                        <span className="page-investimentos-card__metric-suffix">
                                                          {' '}
                                                          ({estAcumulado.aliquotaFmt})
                                                        </span>
                                                      </>
                                                    )}
                                                  </dd>
                                                </div>
                                                <div className="page-investimentos-card__metric">
                                                  <dt className="page-investimentos-card__metric-label">Rendimento líquido acumulado (est.)</dt>
                                                  <dd className="page-investimentos-card__metric-value">
                                                    {formatCurrencyBRL(estAcumulado.liquidoAcumulado)}
                                                  </dd>
                                                </div>
                                              </>
                                            ) : null}
                                            <div className="page-investimentos-card__metric page-investimentos-card__metric--total">
                                              <dt className="page-investimentos-card__metric-label">Total estimado</dt>
                                              <dd
                                                className="page-investimentos-card__metric-value"
                                                title="Valor aplicado + rendimento líquido acumulado estimado até hoje"
                                              >
                                                {formatCurrencyBRL(
                                                  Number(row.valor_investido) +
                                                    (estAcumulado?.liquidoAcumulado ?? estRendimentoExibicao.liquido),
                                                )}
                                              </dd>
                                            </div>
                                          </>
                                        ) : null}
                                      </dl>
                                    </>
                                  ) : null}
                                  {!(dataAquisicaoYmd && (temValor || percLista)) ? (
                                    <p className="page-investimentos-card__meta">
                                      {dataAquisicaoYmd ? (
                                        <>
                                          <span className="page-investimentos-card__date-label">Adquirido em</span>{' '}
                                          <time dateTime={dataAquisicaoYmd}>
                                            {formatDataAquisicaoCartao(row.data_aquisicao)}
                                          </time>
                                        </>
                                      ) : (
                                        <>
                                          <span className="page-investimentos-card__date-label">Registado em</span>{' '}
                                          <time dateTime={row.criado_em || undefined}>{formatData(row.criado_em)}</time>
                                        </>
                                      )}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="page-investimentos-card__actions">
                                  <button
                                    type="button"
                                    className="page-investimentos-card__edit"
                                    onClick={() => {
                                      setEditTarget(row)
                                      setModalOpen(true)
                                    }}
                                    disabled={!uid}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="page-investimentos-card__remove"
                                    onClick={() => setRemoveTarget({ id: row.id, nome: row.nome })}
                                  >
                                    Remover
                                  </button>
                                </div>
                              </article>
                            </li>
                          )
                        })}
                      </ul>
                    )}
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
    </div>
  )
}
