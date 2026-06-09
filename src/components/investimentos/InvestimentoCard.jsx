import React, { useState } from 'react'
import {
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
} from '../../lib/investimentosRendimentoIr'
import { formatCurrencyBRL } from '../../lib/formatCurrency'
import { formatPercentualCdiLista } from '../../lib/percentualCdiInput'
import { INVESTIMENTOS_PRESETS_LIST } from '../../lib/investimentosPresets'
import { ymdLocalFromDate, ymdMaxProjecaoLocal, formatYmdPtBr, isoParaCalculoDias } from '../../lib/investimentosUtils'
import { getLogoInstituicao } from '../../lib/bankLogos'

function labelTipoInvestimentoPreset(key) {
  if (key == null || String(key).trim() === '') return null
  const k = String(key).toUpperCase()
  return INVESTIMENTOS_PRESETS_LIST.find((p) => p.key === k)?.label || k
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

function formatDataRegistado(iso) {
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
      return d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/-feira/i, '')
    }
    d.setDate(d.getDate() + 1)
  }
  return 'próximo dia útil'
}

function computeAliquotaFmt(brutoTotal, irTotal, allIsento) {
  if (allIsento) return 'Isento (PF)'
  if (brutoTotal > 0) return `~${((irTotal / brutoTotal) * 100).toFixed(1)}% ef.`
  return '—'
}

export default function InvestimentoCard({ row, cdiAa, cdiLoading, pregaoCdiHoje, uid, onEdit, onRemove, onAportar, onVerAportes }) {
  // null = untouched (falls through to default); '' = explicitly cleared
  const [projecaoAteYmd, setProjecaoAteYmd] = useState(null)
  const [collapsed, setCollapsed] = useState(true)

  const tipoLb = labelTipoInvestimentoPreset(row.tipo_preset)

  // Aportes — fallback para single-aporte legado
  const aportes = (row.aportes && row.aportes.length > 0)
    ? row.aportes
    : [{ id: row.id + '_base', valor: row.valor_investido, data_aquisicao: row.data_aquisicao, criado_em: row.criado_em }]
  const multiAporte = aportes.length > 1

  const percLista = formatPercentualCdiLista(row.percentual_cdi)
  const percNum = Number(row.percentual_cdi)
  const percOk = Number.isFinite(percNum) && percNum > 0
  const isentoIr = investimentoIsentoIrPessoaFisica(row.tipo_preset)
  const tipoIndexador = row.tipo_indexador ?? 'CDI'
  const isPrefixado = tipoIndexador === 'PREFIXADO'
  const temValor = row.valor_investido != null && Number.isFinite(Number(row.valor_investido)) && Number(row.valor_investido) > 0
  const mostrarRendimento = temValor && percOk
  const cdiDisponivel = !cdiLoading && cdiAa != null && Number.isFinite(cdiAa) && cdiAa > 0
  const podeCalcular = mostrarRendimento && (cdiDisponivel || isPrefixado)
  const percExibicao = isPrefixado
    ? `${Number(row.percentual_cdi).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
    : percLista

  // Cálculo por aporte — cada um com seu timer de IR
  const aportesCalcArr = podeCalcular
    ? aportes.map((aporte) => {
        const valorA = Number(aporte.valor)
        if (!Number.isFinite(valorA) || valorA <= 0) return null
        const isoCalcA = isoParaCalculoDias(aporte.data_aquisicao, aporte.criado_em)
        const diasCorridosA = diasCorridosDesdeIso(isoCalcA)
        const diasUteisA = contarDiasUteisComJurosDesdeIso(isoCalcA)
        const estRendA = estimativaRendimentoDiarioComIr(valorA, percNum, cdiAa, diasCorridosA, isentoIr, tipoIndexador)
        const estAcumA = estimativaRendimentoAcumuladoAteHoje(valorA, percNum, cdiAa, diasCorridosA, isentoIr, diasUteisA ?? 0, tipoIndexador)
        return { aporte, isoCalcA, diasCorridosA, diasUteisA, estRendA, estAcumA }
      }).filter(Boolean)
    : []

  // Dados do aporte base (primeiro cronologicamente) para a view simplificada
  const aporteBase = aportes[0]
  const dataAquisicaoYmd = extrairYyyyMmDdReferencia(row.data_aquisicao)
  const isoCalculoDias = isoParaCalculoDias(aporteBase?.data_aquisicao ?? row.data_aquisicao, aporteBase?.criado_em ?? row.criado_em)
  const diasRegisto = diasCorridosDesdeIso(isoCalculoDias)

  // Agregar rendimento diário
  const allHaveRend = aportesCalcArr.length > 0 && aportesCalcArr.every((a) => a.estRendA)
  const estRendimento = allHaveRend ? {
    bruto: aportesCalcArr.reduce((s, a) => s + (a.estRendA?.bruto ?? 0), 0),
    imposto: aportesCalcArr.reduce((s, a) => s + (a.estRendA?.imposto ?? 0), 0),
    liquido: aportesCalcArr.reduce((s, a) => s + (a.estRendA?.liquido ?? 0), 0),
    isento: aportesCalcArr.every((a) => a.estRendA?.isento),
    aliquotaFmt: computeAliquotaFmt(
      aportesCalcArr.reduce((s, a) => s + (a.estRendA?.bruto ?? 0), 0),
      aportesCalcArr.reduce((s, a) => s + (a.estRendA?.imposto ?? 0), 0),
      aportesCalcArr.every((a) => a.estRendA?.isento),
    ),
  } : null

  const allHaveAcum = aportesCalcArr.length > 0 && aportesCalcArr.every((a) => a.estAcumA)
  const estAcumulado = allHaveAcum ? {
    brutoAcumulado: aportesCalcArr.reduce((s, a) => s + (a.estAcumA?.brutoAcumulado ?? 0), 0),
    impostoAcumulado: aportesCalcArr.reduce((s, a) => s + (a.estAcumA?.impostoAcumulado ?? 0), 0),
    liquidoAcumulado: aportesCalcArr.reduce((s, a) => s + (a.estAcumA?.liquidoAcumulado ?? 0), 0),
    isento: aportesCalcArr.every((a) => a.estAcumA?.isento),
    diasUteisAcumulacao: Math.max(...aportesCalcArr.map((a) => a.estAcumA?.diasUteisAcumulacao ?? 0)),
    aliquotaFmt: computeAliquotaFmt(
      aportesCalcArr.reduce((s, a) => s + (a.estAcumA?.brutoAcumulado ?? 0), 0),
      aportesCalcArr.reduce((s, a) => s + (a.estAcumA?.impostoAcumulado ?? 0), 0),
      aportesCalcArr.every((a) => a.estAcumA?.isento),
    ),
  } : null

  const bloqueioCdiDetalhe = mostrarRendimento && !isPrefixado && (cdiLoading || !cdiDisponivel)
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
  const ymdSimDefault = dataVencimentoYmd && dataVencimentoYmd > hojeYmd ? dataVencimentoYmd : undefined
  const ymdSim = projecaoAteYmd !== null ? projecaoAteYmd : ymdSimDefault

  let projecaoErroMsg = null
  let estProjecaoData = null
  if (mostrarGrelhaCompleta && ymdSim && ymdRefInvest && estRendimento && !projecaoErroMsg) {
    if (ymdSim < hojeYmd) {
      projecaoErroMsg = 'Escolha uma data a partir de hoje.'
    } else if (ymdSim < ymdRefInvest) {
      projecaoErroMsg = 'A data deve ser igual ou posterior à data de referência do investimento.'
    } else {
      const projecoes = aportesCalcArr.map((ac) => {
        const duP = contarDiasUteisComJurosAteYmd(ac.isoCalcA, ymdSim)
        const dcP = diasCorridosEntreReferenciasIso(ac.isoCalcA, ymdSim)
        if (duP == null || dcP == null) return null
        return estimativaRendimentoAcumuladoAteHoje(Number(ac.aporte.valor), percNum, cdiAa, dcP, isentoIr, duP, tipoIndexador)
      }).filter(Boolean)
      if (projecoes.length > 0 && projecoes.length === aportesCalcArr.length) {
        const brutoP = projecoes.reduce((s, p) => s + p.brutoAcumulado, 0)
        const irP = projecoes.reduce((s, p) => s + p.impostoAcumulado, 0)
        estProjecaoData = {
          brutoAcumulado: brutoP,
          impostoAcumulado: irP,
          liquidoAcumulado: projecoes.reduce((s, p) => s + p.liquidoAcumulado, 0),
          isento: projecoes.every((p) => p.isento),
          diasUteisAcumulacao: Math.max(...projecoes.map((p) => p.diasUteisAcumulacao)),
          aliquotaFmt: computeAliquotaFmt(brutoP, irP, projecoes.every((p) => p.isento)),
        }
      }
    }
  }

  const nomeRow = String(row.nome ?? '').trim()
  const tituloRedundanteComChipTipo =
    tipoLb != null &&
    nomeRow !== '' &&
    nomeRow.toUpperCase() === String(tipoLb).trim().toUpperCase()

  const logoSrc = getLogoInstituicao(row.instituicao_nome)
  const instIniciais = String(row.instituicao_nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const valorResumido = estAcumulado
    ? formatCurrencyBRL(Number(row.valor_investido) + estAcumulado.liquidoAcumulado)
    : temValor
    ? formatCurrencyBRL(Number(row.valor_investido))
    : null

  return (
    <article
      className={`page-investimentos-card${mostrarGrelhaCompleta ? ' page-investimentos-card--metricas-completas' : ''}${collapsed ? ' page-investimentos-card--collapsed' : ''}`}
      aria-label={
        tituloRedundanteComChipTipo
          ? `${row.instituicao_nome || 'Investimento'}, ${tipoLb}`
          : undefined
      }
    >
      <div className="page-investimentos-card__main">
        <div className="page-investimentos-card__top-row">
          {collapsed && (
            <div className="page-investimentos-card__bank-avatar" aria-hidden="true">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt=""
                  className="page-investimentos-card__bank-logo"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling?.removeAttribute('hidden') }}
                />
              ) : null}
              <span className="page-investimentos-card__bank-initials" hidden={!!logoSrc}>
                {instIniciais}
              </span>
            </div>
          )}
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
          <div className="page-investimentos-card__collapse-area">
            {collapsed && valorResumido ? (
              <span className="page-investimentos-card__collapsed-value">{valorResumido}</span>
            ) : null}
            <button
              type="button"
              className="page-investimentos-card__collapse-btn"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expandir card' : 'Minimizar card'}
            >
              <svg
                className={`page-investimentos-card__collapse-chevron${collapsed ? ' page-investimentos-card__collapse-chevron--collapsed' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        {collapsed ? (
          !tituloRedundanteComChipTipo ? (
            <p className="page-investimentos-card__collapsed-nome">{row.nome}</p>
          ) : null
        ) : (
          <>
            {multiAporte && (
              <button
                type="button"
                className="page-investimentos-card__aportes-link"
                onClick={() => onVerAportes?.(row)}
              >
                {aportes.length} aportes — ver detalhes
              </button>
            )}

            {!tituloRedundanteComChipTipo ? (
              <h3 className="page-investimentos-card__title">{row.nome}</h3>
            ) : null}
          </>
        )}

        {!collapsed && mostrarRendimento && cdiDisponivel && !dataAquisicaoYmd ? (
          <p className="page-investimentos-card__missing-date-banner" role="alert">
            Sem data de aquisição — o acumulado usa o dia em que criou o registo. Abra Editar e confirme a data da compra.
          </p>
        ) : null}

        {!collapsed && (<>

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
                    title={`~${estAcumulado.diasUteisAcumulacao} dias úteis com pregão desde o 1.º dia útil após a aquisição`}
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
                lang="pt-BR"
                className="page-investimentos-card__projecao-input"
                min={hojeYmd}
                max={maxYmdProj}
                value={ymdSim ?? ''}
                onChange={(e) => setProjecaoAteYmd(e.target.value)}
                aria-describedby={projecaoErroMsg ? `inv-proj-err-${row.id}` : undefined}
              />
            </div>
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
            <time dateTime={row.criado_em || undefined}>{formatDataRegistado(row.criado_em)}</time>
          </p>
        ) : null}

        {/* Barra de progresso do vencimento */}
        {dataAquisicaoYmd && dataVencimentoYmd && (() => {
          const inicio = new Date(`${dataAquisicaoYmd}T12:00:00`)
          const fim = new Date(`${dataVencimentoYmd}T12:00:00`)
          const hoje = new Date(); hoje.setHours(12,0,0,0)
          const totalDias = Math.round((fim - inicio) / 86400000)
          const decorridoDias = Math.round((hoje - inicio) / 86400000)
          const pct = totalDias > 0 ? Math.min(Math.max((decorridoDias / totalDias) * 100, 0), 100) : 0
          return (
            <div className="page-investimentos-card__venc-progress" title={`${pct.toFixed(0)}% do prazo decorrido`}>
              <div className="page-investimentos-card__venc-progress-bar" style={{ width: `${pct.toFixed(2)}%` }} />
            </div>
          )
        })()}

        {/* Notas */}
        {row.notas ? (
          <p className="page-investimentos-card__notas">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            {row.notas}
          </p>
        ) : null}

        </>)}
      </div>

      {!collapsed && <div className="page-investimentos-card__actions">
        <button
          type="button"
          className="page-investimentos-card__edit"
          onClick={() => onEdit(row)}
          disabled={!uid}
          aria-label={`Editar ${row.nome || row.instituicao_nome || 'investimento'}`}
        >
          Editar
        </button>
        <button
          type="button"
          className="page-investimentos-card__aporte"
          onClick={() => onAportar?.(row)}
          disabled={!uid}
          aria-label={`Aportar em ${row.nome || row.instituicao_nome || 'investimento'}`}
        >
          + Aportar
        </button>
        <button
          type="button"
          className="page-investimentos-card__remove"
          onClick={() => onRemove({ id: row.id, nome: row.nome })}
          aria-label={`Remover ${row.nome || row.instituicao_nome || 'investimento'}`}
        >
          Remover
        </button>
      </div>}
    </article>
  )
}
