import React, { useCallback, useEffect, useMemo, useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import InvestimentoNovoModal from '../components/investimentos/InvestimentoNovoModal.jsx'
import InvestimentosResumo from '../components/investimentos/InvestimentosResumo.jsx'
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
  contarDiasUteisComJurosAteYmd,
  contarDiasUteisComJurosDesdeIso,
  diasCorridosDesdeIso,
  diasCorridosEntreReferenciasIso,
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
  }
}

function calcDiasAteYmd(ymd) {
  const hojeYmd = ymdLocalFromDate()
  if (!ymd) return null
  const target = new Date(`${ymd}T12:00:00`)
  const hoje = new Date(`${hojeYmd}T12:00:00`)
  return Math.round((target - hoje) / (1000 * 60 * 60 * 24))
}

function chipVencimentoProps(dias) {
  if (dias < 0) return { cls: 'page-investimentos-chip--vencido', texto: 'Vencido' }
  if (dias === 0) return { cls: 'page-investimentos-chip--vencimento-urgente', texto: 'Vence hoje' }
  if (dias <= 30) return { cls: 'page-investimentos-chip--vencimento-urgente', texto: `Vence em ${dias} d.` }
  if (dias <= 90) return { cls: 'page-investimentos-chip--vencimento-proximo', texto: `Vence em ${dias} d.` }
  return { cls: 'page-investimentos-chip--vencimento', texto: `Vence em ${dias} d.` }
}

function proximoDiaUtilLabel() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  for (let i = 0; i < 7; i++) {
    if (ehDiaUtilComPregaoCdi(d)) {
      return d.toLocaleDateString('pt-BR', { weekday: 'long' })
    }
    d.setDate(d.getDate() + 1)
  }
  return 'próximo dia útil'
}

function ymdLocalFromDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ymdMaxProjecaoLocal() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 50)
  return ymdLocalFromDate(d)
}

function formatYmdPtBr(ymd) {
  if (!ymd) return ''
  try {
    return new Date(`${ymd}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ymd
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
  const [projecaoAteYmdPorId, setProjecaoAteYmdPorId] = useState({})

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
                        {listaExibicao.map((row) => {
                          const tipoLb = labelTipoInvestimentoPreset(row.tipo_preset)
                          const temValor =
                            row.valor_investido != null && Number.isFinite(Number(row.valor_investido))
                          const percLista = formatPercentualCdiLista(row.percentual_cdi)
                          const percNum = Number(row.percentual_cdi)
                          const percOk = Number.isFinite(percNum) && percNum > 0
                          const isentoIr = investimentoIsentoIrPessoaFisica(row.tipo_preset)
                          const tipoIndexador = row.tipo_indexador ?? 'CDI'
                          const isPrefixado = tipoIndexador === 'PREFIXADO'
                          const dataAquisicaoYmd = extrairYyyyMmDdReferencia(row.data_aquisicao)
                          const isoCalculoDias = isoOuDataParaCalculoDias(row.data_aquisicao, row.criado_em)
                          const diasRegisto = diasCorridosDesdeIso(isoCalculoDias)
                          const diasUteisComJuros = contarDiasUteisComJurosDesdeIso(isoCalculoDias)
                          const mostrarRendimento = temValor && percOk
                          const cdiDisponivel = !cdiLoading && cdiAa != null && Number.isFinite(cdiAa) && cdiAa > 0
                          const podeCalcular = mostrarRendimento && (cdiDisponivel || isPrefixado)
                          const percExibicao = isPrefixado
                            ? `${Number(row.percentual_cdi).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
                            : percLista
                          const estRendimento = podeCalcular
                            ? estimativaRendimentoDiarioComIr(
                                Number(row.valor_investido),
                                percNum,
                                cdiAa,
                                diasRegisto,
                                isentoIr,
                                tipoIndexador,
                              )
                            : null
                          const estAcumulado = estRendimento
                            ? estimativaRendimentoAcumuladoAteHoje(
                                Number(row.valor_investido),
                                percNum,
                                cdiAa,
                                diasRegisto,
                                isentoIr,
                                diasUteisComJuros ?? 0,
                                tipoIndexador,
                              )
                            : null
                          const bloqueioCdiDetalhe =
                            mostrarRendimento && !isPrefixado && (cdiLoading || !cdiDisponivel)
                          const estRendimentoExibicao =
                            estRendimento && !isPrefixado && !pregaoCdiHoje
                              ? { ...estRendimento, bruto: 0, imposto: 0, liquido: 0 }
                              : estRendimento
                          const mostrarGrelhaCompleta = Boolean(
                            podeCalcular && estRendimento && estRendimentoExibicao && estAcumulado && !bloqueioCdiDetalhe,
                          )
                          const hojeYmd = ymdLocalFromDate()
                          const maxYmdProj = ymdMaxProjecaoLocal()
                          const ymdRefInvest = extrairYyyyMmDdReferencia(isoCalculoDias)
                          const dataVencimentoYmd = extrairYyyyMmDdReferencia(row.data_vencimento)
                          const diasAteVencimento = dataVencimentoYmd != null ? calcDiasAteYmd(dataVencimentoYmd) : null
                          const ymdSimFromState = projecaoAteYmdPorId[row.id]
                          const ymdSimDefault = dataVencimentoYmd && dataVencimentoYmd > hojeYmd ? dataVencimentoYmd : undefined
                          const ymdSim = ymdSimFromState !== undefined ? ymdSimFromState : ymdSimDefault
                          let projecaoErroMsg = null
                          let estProjecaoData = null
                          if (mostrarGrelhaCompleta && ymdSim && ymdRefInvest && estRendimento) {
                            if (ymdSim < hojeYmd) {
                              projecaoErroMsg = 'Escolha uma data a partir de hoje.'
                            } else if (ymdSim < ymdRefInvest) {
                              projecaoErroMsg =
                                'A data deve ser igual ou posterior à data de referência do investimento.'
                            } else {
                              const duP = contarDiasUteisComJurosAteYmd(isoCalculoDias, ymdSim)
                              const dcP = diasCorridosEntreReferenciasIso(isoCalculoDias, ymdSim)
                              if (duP != null && dcP != null) {
                                estProjecaoData = estimativaRendimentoAcumuladoAteHoje(
                                  Number(row.valor_investido),
                                  percNum,
                                  cdiAa,
                                  dcP,
                                  isentoIr,
                                  duP,
                                  tipoIndexador,
                                )
                              }
                            }
                          }
                          const nomeRow = String(row.nome ?? '').trim()
                          const tituloRedundanteComChipTipo =
                            tipoLb != null &&
                            nomeRow !== '' &&
                            nomeRow.toUpperCase() === String(tipoLb).trim().toUpperCase()
                          return (
                            <li key={row.id}>
                              <article
                                className={`page-investimentos-card${mostrarGrelhaCompleta ? ' page-investimentos-card--metricas-completas' : ''}`}
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
                                    {percExibicao ? (
                                      <span className="page-investimentos-chip page-investimentos-chip--taxa">{percExibicao}</span>
                                    ) : null}
                                    {isentoIr ? (
                                      <span className="page-investimentos-chip page-investimentos-chip--isento">Isento IR (PF)</span>
                                    ) : null}
                                    {dataVencimentoYmd ? (() => {
                                      const { cls, texto } = chipVencimentoProps(diasAteVencimento)
                                      return <span className={`page-investimentos-chip ${cls}`}>{texto}</span>
                                    })() : null}
                                  </div>

                                  {!tituloRedundanteComChipTipo ? (
                                    <h3 className="page-investimentos-card__title">{row.nome}</h3>
                                  ) : null}

                                  {mostrarRendimento && cdiDisponivel && !dataAquisicaoYmd ? (
                                    <p className="page-investimentos-card__missing-date-banner" role="alert">
                                      Sem data de aquisição — o acumulado usa o dia em que criou o registo. Abra Editar e confirme a data da compra.
                                    </p>
                                  ) : null}

                                  {estAcumulado ? (
                                    <div className="page-investimentos-card__primary">
                                      <div className="page-investimentos-card__primary-block">
                                        <p className="page-investimentos-card__primary-label">Total estimado</p>
                                        <p className="page-investimentos-card__primary-value">
                                          {formatCurrencyBRL(Number(row.valor_investido) + estAcumulado.liquidoAcumulado)}
                                        </p>
                                      </div>
                                      <div className="page-investimentos-card__primary-block page-investimentos-card__primary-block--right">
                                        <p className="page-investimentos-card__primary-rendimento">
                                          +{formatCurrencyBRL(estAcumulado.liquidoAcumulado)}
                                        </p>
                                        {Number(row.valor_investido) > 0 ? (
                                          <p className="page-investimentos-card__primary-pct">
                                            +{((estAcumulado.liquidoAcumulado / Number(row.valor_investido)) * 100).toLocaleString('pt-BR', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}% no período
                                          </p>
                                        ) : null}
                                        <p className="page-investimentos-card__primary-sublabel">Rendimento líquido acumulado</p>
                                      </div>
                                    </div>
                                  ) : temValor ? (
                                    <div className="page-investimentos-card__primary">
                                      <div className="page-investimentos-card__primary-block">
                                        <p className="page-investimentos-card__primary-label">Valor aplicado</p>
                                        <p className="page-investimentos-card__primary-value">
                                          {formatCurrencyBRL(Number(row.valor_investido))}
                                        </p>
                                      </div>
                                    </div>
                                  ) : null}

                                  {temValor || dataAquisicaoYmd || podeCalcular ? (
                                    <dl className="page-investimentos-card__metrics" aria-label="Detalhes do investimento">
                                      {mostrarGrelhaCompleta ? (
                                        <>
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
                                          {dataVencimentoYmd ? (
                                            <div className="page-investimentos-card__metric page-investimentos-card__metric--span page-investimentos-card__metric--vencimento">
                                              <dt className="page-investimentos-card__metric-label">Vencimento</dt>
                                              <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--date">
                                                <time dateTime={dataVencimentoYmd}>
                                                  {formatDataAquisicaoCartao(row.data_vencimento)}
                                                </time>
                                                {diasAteVencimento !== null ? (
                                                  <span className={`page-investimentos-card__metric-suffix${diasAteVencimento < 0 ? ' page-investimentos-card__metric-suffix--vencido' : diasAteVencimento <= 30 ? ' page-investimentos-card__metric-suffix--urgente' : ''}`}>
                                                    {' '}
                                                    {diasAteVencimento < 0
                                                      ? `(vencido há ${Math.abs(diasAteVencimento)} d.)`
                                                      : diasAteVencimento === 0
                                                        ? '(vence hoje)'
                                                        : `(faltam ${diasAteVencimento} d.)`}
                                                  </span>
                                                ) : null}
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
                                          {percExibicao ? (
                                            <div className="page-investimentos-card__metric">
                                              <dt className="page-investimentos-card__metric-label">
                                                {isPrefixado ? 'Taxa pré-fixada a.a.' : '% do CDI contratada'}
                                              </dt>
                                              <dd className="page-investimentos-card__metric-value">{percExibicao}</dd>
                                            </div>
                                          ) : null}
                                          <div className="page-investimentos-card__metrics-rule-wrap" aria-hidden>
                                            <dt className="sr-only">Estimativa por dia útil</dt>
                                            <dd className="page-investimentos-card__metrics-rule-line" />
                                          </div>
                                          <div className="page-investimentos-card__metric">
                                            <dt className="page-investimentos-card__metric-label">
                                              Rendimento bruto por dia útil (est.)
                                            </dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              {formatMoedaDiariaEstimativa(estRendimentoExibicao.bruto)}
                                            </dd>
                                          </div>
                                          <div className="page-investimentos-card__metric">
                                            <dt className="page-investimentos-card__metric-label">IR sobre rendimento (est.)</dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              {estRendimentoExibicao.isento ? (
                                                <span className="page-investimentos-card__ir-isento">
                                                  {estRendimentoExibicao.aliquotaFmt}
                                                </span>
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
                                            <dt className="page-investimentos-card__metric-label">
                                              Rendimento líquido por dia útil (est.)
                                            </dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              {formatMoedaDiariaEstimativa(estRendimentoExibicao.liquido)}
                                            </dd>
                                          </div>
                                          <div className="page-investimentos-card__metrics-rule-wrap" aria-hidden>
                                            <dt className="sr-only">Valores acumulados</dt>
                                            <dd className="page-investimentos-card__metrics-rule-line" />
                                          </div>
                                          <div className="page-investimentos-card__metric">
                                            <dt className="page-investimentos-card__metric-label">
                                              Rendimento bruto acumulado (est.)
                                            </dt>
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
                                            <dt className="page-investimentos-card__metric-label">
                                              Rendimento líquido acumulado (est.)
                                            </dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              {formatCurrencyBRL(estAcumulado.liquidoAcumulado)}
                                            </dd>
                                          </div>
                                          <div className="page-investimentos-card__metric page-investimentos-card__metric--span page-investimentos-card__metric--total">
                                            <dt className="page-investimentos-card__metric-label">Total estimado</dt>
                                            <dd
                                              className="page-investimentos-card__metric-value"
                                              title="Valor aplicado + rendimento líquido acumulado estimado até hoje"
                                            >
                                              {formatCurrencyBRL(
                                                Number(row.valor_investido) + estAcumulado.liquidoAcumulado,
                                              )}
                                            </dd>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          {estAcumulado && temValor ? (
                                            <div className="page-investimentos-card__metric">
                                              <dt className="page-investimentos-card__metric-label">Valor aplicado</dt>
                                              <dd className="page-investimentos-card__metric-value">
                                                {formatCurrencyBRL(Number(row.valor_investido))}
                                              </dd>
                                            </div>
                                          ) : null}
                                          {dataAquisicaoYmd ? (
                                            <div className="page-investimentos-card__metric">
                                              <dt className="page-investimentos-card__metric-label">Adquirido em</dt>
                                              <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--date">
                                                <time dateTime={dataAquisicaoYmd}>
                                                  {formatDataAquisicaoCartao(row.data_aquisicao)}
                                                </time>
                                                {diasRegisto != null && diasRegisto > 0 ? (
                                                  <span className="page-investimentos-card__metric-suffix">
                                                    {' '}
                                                    (há {diasRegisto} d.)
                                                  </span>
                                                ) : null}
                                              </dd>
                                            </div>
                                          ) : null}
                                          {dataVencimentoYmd ? (
                                            <div className="page-investimentos-card__metric">
                                              <dt className="page-investimentos-card__metric-label">Vencimento</dt>
                                              <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--date">
                                                <time dateTime={dataVencimentoYmd}>
                                                  {formatDataAquisicaoCartao(row.data_vencimento)}
                                                </time>
                                                {diasAteVencimento !== null ? (
                                                  <span className={`page-investimentos-card__metric-suffix${diasAteVencimento < 0 ? ' page-investimentos-card__metric-suffix--vencido' : diasAteVencimento <= 30 ? ' page-investimentos-card__metric-suffix--urgente' : ''}`}>
                                                    {' '}
                                                    {diasAteVencimento < 0
                                                      ? `(vencido há ${Math.abs(diasAteVencimento)} d.)`
                                                      : diasAteVencimento === 0
                                                        ? '(vence hoje)'
                                                        : `(faltam ${diasAteVencimento} d.)`}
                                                  </span>
                                                ) : null}
                                              </dd>
                                            </div>
                                          ) : null}
                                          {estRendimento && pregaoCdiHoje ? (
                                            <div className="page-investimentos-card__metric">
                                              <dt className="page-investimentos-card__metric-label">Rendimento hoje (líq.)</dt>
                                              <dd className="page-investimentos-card__metric-value">
                                                {formatMoedaDiariaEstimativa(estRendimento.liquido)}
                                              </dd>
                                            </div>
                                          ) : null}
                                          {podeCalcular && !pregaoCdiHoje ? (
                                            <div className="page-investimentos-card__metric page-investimentos-card__metric--span">
                                              <dt className="page-investimentos-card__metric-label">Rendimento hoje</dt>
                                              <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--muted">
                                                Próximo pregão: {proximoDiaUtilLabel()}
                                              </dd>
                                            </div>
                                          ) : null}
                                          {mostrarRendimento && !isPrefixado && cdiLoading ? (
                                            <div className="page-investimentos-card__metric page-investimentos-card__metric--span">
                                              <dt className="page-investimentos-card__metric-label">Rendimento</dt>
                                              <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--muted">
                                                A carregar taxa CDI…
                                              </dd>
                                            </div>
                                          ) : null}
                                          {mostrarRendimento && !isPrefixado && !cdiLoading && !cdiDisponivel ? (
                                            <div className="page-investimentos-card__metric page-investimentos-card__metric--span">
                                              <dt className="page-investimentos-card__metric-label">Rendimento</dt>
                                              <dd className="page-investimentos-card__metric-value page-investimentos-card__metric-value--muted">
                                                Indisponível (taxa CDI)
                                              </dd>
                                            </div>
                                          ) : null}
                                        </>
                                      )}
                                    </dl>
                                  ) : null}

                                  {mostrarGrelhaCompleta ? (
                                    <div className="page-investimentos-card__projecao">
                                      <div className="page-investimentos-card__projecao-row">
                                        <label
                                          className="page-investimentos-card__projecao-label"
                                          htmlFor={`inv-proj-${row.id}`}
                                        >
                                          Simular acumulado até
                                        </label>
                                        <input
                                          id={`inv-proj-${row.id}`}
                                          type="date"
                                          className="page-investimentos-card__projecao-input"
                                          min={hojeYmd}
                                          max={maxYmdProj}
                                          value={ymdSim ?? ''}
                                          onChange={(e) => {
                                            const v = e.target.value
                                            setProjecaoAteYmdPorId((prev) => ({ ...prev, [row.id]: v }))
                                          }}
                                          aria-describedby={`inv-proj-hint-${row.id}${projecaoErroMsg ? ` inv-proj-err-${row.id}` : ''}`}
                                        />
                                      </div>
                                      <p className="page-investimentos-card__projecao-hint" id={`inv-proj-hint-${row.id}`}>
                                        Dias úteis com pregão e IR regressivo pelos dias corridos até a data (mesma
                                        metodologia do quadro acima). Taxa {isPrefixado ? 'pré-fixada' : 'e CDI'}{' '}
                                        assumidas constantes — estimativa.
                                      </p>
                                      {projecaoErroMsg ? (
                                        <p
                                          className="page-investimentos-card__projecao-erro"
                                          id={`inv-proj-err-${row.id}`}
                                          role="alert"
                                        >
                                          {projecaoErroMsg}
                                        </p>
                                      ) : null}
                                      {estProjecaoData && ymdSim ? (
                                        <dl
                                          className="page-investimentos-card__metrics page-investimentos-card__metrics--projecao"
                                          aria-label={`Projeção até ${formatYmdPtBr(ymdSim)}`}
                                        >
                                          <div className="page-investimentos-card__metric page-investimentos-card__metric--span">
                                            <dt className="page-investimentos-card__metric-label">
                                              Dias úteis com pregão (até {formatYmdPtBr(ymdSim)})
                                            </dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              ~{estProjecaoData.diasUteisAcumulacao}
                                            </dd>
                                          </div>
                                          <div className="page-investimentos-card__metric">
                                            <dt className="page-investimentos-card__metric-label">
                                              Rendimento bruto acumulado (est.)
                                            </dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              {formatCurrencyBRL(estProjecaoData.brutoAcumulado)}
                                            </dd>
                                          </div>
                                          <div className="page-investimentos-card__metric">
                                            <dt className="page-investimentos-card__metric-label">IR acumulado (est.)</dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              {estProjecaoData.isento ? (
                                                <span className="page-investimentos-card__ir-isento">
                                                  {estProjecaoData.aliquotaFmt}
                                                </span>
                                              ) : (
                                                <>
                                                  {formatCurrencyBRL(estProjecaoData.impostoAcumulado)}
                                                  <span className="page-investimentos-card__metric-suffix">
                                                    {' '}
                                                    ({estProjecaoData.aliquotaFmt})
                                                  </span>
                                                </>
                                              )}
                                            </dd>
                                          </div>
                                          <div className="page-investimentos-card__metric">
                                            <dt className="page-investimentos-card__metric-label">
                                              Rendimento líquido acumulado (est.)
                                            </dt>
                                            <dd className="page-investimentos-card__metric-value">
                                              {formatCurrencyBRL(estProjecaoData.liquidoAcumulado)}
                                            </dd>
                                          </div>
                                          <div className="page-investimentos-card__metric page-investimentos-card__metric--span page-investimentos-card__metric--total page-investimentos-card__metric--projecao-total">
                                            <dt className="page-investimentos-card__metric-label">
                                              Total estimado em {formatYmdPtBr(ymdSim)}
                                            </dt>
                                            <dd
                                              className="page-investimentos-card__metric-value"
                                              title="Valor aplicado + rendimento líquido acumulado projetado até a data"
                                            >
                                              {formatCurrencyBRL(
                                                Number(row.valor_investido) + estProjecaoData.liquidoAcumulado,
                                              )}
                                            </dd>
                                          </div>
                                        </dl>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {!temValor && !dataAquisicaoYmd ? (
                                    <p className="page-investimentos-card__meta">
                                      <span className="page-investimentos-card__date-label">Registado em</span>{' '}
                                      <time dateTime={row.criado_em || undefined}>{formatData(row.criado_em)}</time>
                                    </p>
                                  ) : null}

                                  {podeCalcular ? (
                                    <p className="page-investimentos-card__disclaimer">
                                      Valores estimados com base no CDI atual
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
