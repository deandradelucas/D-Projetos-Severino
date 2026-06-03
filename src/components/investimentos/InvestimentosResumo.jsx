import React, { useMemo, useState } from 'react'
import DonutChart from './DonutChart'
import {
  estimativaRendimentoAcumuladoAteHoje,
  contarDiasUteisComJurosAteYmd,
  contarDiasUteisComJurosDesdeIso,
  diasCorridosDesdeIso,
  diasCorridosEntreReferenciasIso,
  investimentoIsentoIrPessoaFisica,
} from '../../lib/investimentosRendimentoIr'
import { formatCurrencyBRL } from '../../lib/formatCurrency'
import { INVESTIMENTOS_PRESETS_LIST } from '../../lib/investimentosPresets'
import { ymdLocalFromDate, ymdMaxProjecaoLocal, formatYmdPtBr, isoParaCalculoDias } from '../../lib/investimentosUtils'

const CHART_COLORS = ['#d4a84b', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']

function labelTipo(key) {
  if (!key || String(key).trim() === '') return 'Personalizado'
  const k = String(key).toUpperCase()
  return INVESTIMENTOS_PRESETS_LIST.find((p) => p.key === k)?.label ?? k
}

const TIPO_COLORS = {
  LCA: '#10b981', LCI: '#3b82f6', CDB: '#d4a84b', CRI: '#8b5cf6',
  CRA: '#06b6d4', CDI: '#f59e0b', DEBENTURE: '#ef4444', TESOURO_SELIC: '#22c55e', POUPANCA: '#a3e635',
}

function calcDiasAteVencimento(ymd) {
  if (!ymd) return null
  const target = new Date(`${ymd}T12:00:00`)
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((target - hoje) / (1000 * 60 * 60 * 24))
}

export default function InvestimentosResumo({ lista, cdiAa, cdiLoading }) {
  const [projecaoYmd, setProjecaoYmd] = useState('')
  const cdiDisponivel = !cdiLoading && cdiAa != null && Number.isFinite(cdiAa) && cdiAa > 0

  const stats = useMemo(() => {
    if (!lista || lista.length === 0) return null

    const hojeYmd = ymdLocalFromDate()
    const maxYmd = ymdMaxProjecaoLocal()
    let projecaoErroMsg = null
    let usarProjecao = false
    if (projecaoYmd) {
      if (projecaoYmd < hojeYmd) {
        projecaoErroMsg = 'Escolha uma data a partir de hoje.'
      } else if (projecaoYmd > maxYmd) {
        projecaoErroMsg = 'Data fora do intervalo permitido.'
      } else {
        usarProjecao = true
      }
    }

    let totalInvestido = 0
    let rendimentoBruto = 0
    let rendimentoLiquido = 0
    let cobertoCount = 0

    for (const row of lista) {
      const valor = Number(row.valor_investido)
      if (Number.isFinite(valor) && valor > 0) totalInvestido += valor

      const tipoIndexador = row.tipo_indexador ?? 'CDI'
      const isPrefixado = tipoIndexador === 'PREFIXADO'
      const podeCalcular = cdiDisponivel || isPrefixado

      if (!podeCalcular) continue
      const perc = Number(row.percentual_cdi)
      if (!Number.isFinite(perc) || perc <= 0) continue
      if (!Number.isFinite(valor) || valor <= 0) continue

      const isoCalc = isoParaCalculoDias(row.data_aquisicao, row.criado_em)
      const diasCorridos = usarProjecao
        ? diasCorridosEntreReferenciasIso(isoCalc, projecaoYmd)
        : diasCorridosDesdeIso(isoCalc)
      const diasUteis = usarProjecao
        ? contarDiasUteisComJurosAteYmd(isoCalc, projecaoYmd)
        : contarDiasUteisComJurosDesdeIso(isoCalc)

      if (diasCorridos == null || diasUteis == null) continue

      const isento = investimentoIsentoIrPessoaFisica(row.tipo_preset)

      const acumulado = estimativaRendimentoAcumuladoAteHoje(
        valor,
        perc,
        cdiAa,
        diasCorridos,
        isento,
        diasUteis,
        tipoIndexador,
      )
      if (acumulado) {
        rendimentoBruto += acumulado.brutoAcumulado
        rendimentoLiquido += acumulado.liquidoAcumulado
        cobertoCount++
      }
    }

    return {
      totalInvestido,
      totalEstimado: totalInvestido + rendimentoLiquido,
      rendimentoBruto,
      rendimentoLiquido,
      parcial: cdiDisponivel && cobertoCount < lista.length,
      simulacaoAtiva: usarProjecao,
      simulacaoYmd: usarProjecao ? projecaoYmd : null,
      projecaoErroMsg,
    }
  }, [lista, cdiAa, cdiDisponivel, projecaoYmd])

  const chartData = useMemo(() => {
    if (!lista || lista.length === 0) return []
    const map = new Map()
    for (const row of lista) {
      const valor = Number(row.valor_investido)
      if (!Number.isFinite(valor) || valor <= 0) continue
      const label = labelTipo(row.tipo_preset)
      map.set(label, (map.get(label) ?? 0) + valor)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [lista])

  const hojeYmdInput = ymdLocalFromDate()
  const maxYmdInput = ymdMaxProjecaoLocal()

  // Alertas de vencimento próximo (≤30 dias)
  const alertasVencimento = useMemo(() => {
    if (!lista) return []
    return lista
      .filter((r) => r.data_vencimento)
      .map((r) => ({ nome: r.nome || r.instituicao_nome, dias: calcDiasAteVencimento(r.data_vencimento) }))
      .filter((a) => a.dias !== null && a.dias <= 30)
      .sort((a, b) => a.dias - b.dias)
  }, [lista])

  // Diversificação por tipo (% de cada tipo no total investido)
  const diversificacao = useMemo(() => {
    if (!lista || lista.length === 0) return []
    const total = lista.reduce((s, r) => s + (Number(r.valor_investido) || 0), 0)
    if (total === 0) return []
    const map = new Map()
    for (const r of lista) {
      const v = Number(r.valor_investido) || 0
      const k = r.tipo_preset || 'Personalizado'
      map.set(k, (map.get(k) ?? 0) + v)
    }
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, label: labelTipo(key), pct: (val / total) * 100, valor: val }))
      .sort((a, b) => b.pct - a.pct)
  }, [lista])

  // Meta da carteira (pega do primeiro item que tiver, ou null)
  const metaCarteira = useMemo(() => {
    if (!lista) return null
    for (const r of lista) {
      if (r.meta_carteira_valor && Number.isFinite(Number(r.meta_carteira_valor)) && Number(r.meta_carteira_valor) > 0) {
        return Number(r.meta_carteira_valor)
      }
    }
    return null
  }, [lista])

  if (!lista || lista.length === 0 || !stats) return null

  const sufixoData =
    stats.simulacaoAtiva && stats.simulacaoYmd ? ` até ${formatYmdPtBr(stats.simulacaoYmd)}` : ''

  const totalInvestidoAtual = stats.totalInvestido

  return (
    <>
    {alertasVencimento.length > 0 && (
      <div className="page-investimentos-alertas" role="alert" aria-live="polite">
        {alertasVencimento.map((a, i) => (
          <div key={i} className={`page-investimentos-alerta${a.dias <= 0 ? ' page-investimentos-alerta--vencido' : a.dias <= 7 ? ' page-investimentos-alerta--urgente' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>
              <strong>{a.nome}</strong>
              {a.dias < 0 ? ` — vencido há ${Math.abs(a.dias)} dia${Math.abs(a.dias) !== 1 ? 's' : ''}` :
               a.dias === 0 ? ' — vence hoje!' :
               ` — vence em ${a.dias} dia${a.dias !== 1 ? 's' : ''}`}
            </span>
          </div>
        ))}
      </div>
    )}
    <article className="ref-panel page-investimentos-resumo" aria-labelledby="inv-resumo-title">
      <div className="ref-panel__head page-investimentos-resumo__head">
        <h2 id="inv-resumo-title" className="ref-panel__title">
          Resumo da carteira
        </h2>
        <div className="page-investimentos-resumo__head-badges">
          {stats.parcial && (
            <span className="page-investimentos-resumo__badge">est. parcial</span>
          )}
          {stats.simulacaoAtiva ? (
            <span className="page-investimentos-resumo__badge page-investimentos-resumo__badge--sim">
              simulação
            </span>
          ) : null}
        </div>
      </div>

      {cdiDisponivel ? (
        <div className="page-investimentos-resumo__projecao">
          <div className="page-investimentos-resumo__projecao-row">
            <label className="page-investimentos-resumo__projecao-label" htmlFor="inv-resumo-proj-data">
              Simular carteira até
            </label>
            <input
              id="inv-resumo-proj-data"
              type="date"
              lang="pt-BR"
              className="page-investimentos-resumo__projecao-input"
              min={hojeYmdInput}
              max={maxYmdInput}
              value={projecaoYmd}
              onChange={(e) => setProjecaoYmd(e.target.value)}
              aria-describedby={stats.projecaoErroMsg ? 'inv-resumo-proj-err' : undefined}
            />
          </div>
          {stats.projecaoErroMsg ? (
            <p id="inv-resumo-proj-err" className="page-investimentos-resumo__projecao-erro" role="alert">
              {stats.projecaoErroMsg}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="page-investimentos-resumo__body">
        <dl className="page-investimentos-resumo__stats">
          <div className="page-investimentos-resumo__stat">
            <dt className="page-investimentos-resumo__stat-label">Total investido</dt>
            <dd className="page-investimentos-resumo__stat-value">
              {formatCurrencyBRL(stats.totalInvestido)}
            </dd>
          </div>

          {cdiDisponivel ? (
            <>
              <div className="page-investimentos-resumo__stat page-investimentos-resumo__stat--accent">
                <dt className="page-investimentos-resumo__stat-label">Total estimado{sufixoData}</dt>
                <dd className="page-investimentos-resumo__stat-value">
                  {formatCurrencyBRL(stats.totalEstimado)}
                </dd>
              </div>
              <div className="page-investimentos-resumo__stat">
                <dt className="page-investimentos-resumo__stat-label">
                  Rendimento bruto (est.){sufixoData}
                </dt>
                <dd className="page-investimentos-resumo__stat-value page-investimentos-resumo__stat-value--pos">
                  +{formatCurrencyBRL(stats.rendimentoBruto)}
                </dd>
              </div>
              <div className="page-investimentos-resumo__stat">
                <dt className="page-investimentos-resumo__stat-label">
                  Rendimento líquido (est.){sufixoData}
                </dt>
                <dd className="page-investimentos-resumo__stat-value page-investimentos-resumo__stat-value--pos">
                  +{formatCurrencyBRL(stats.rendimentoLiquido)}
                </dd>
              </div>
            </>
          ) : cdiLoading ? (
            <div className="page-investimentos-resumo__stat page-investimentos-resumo__stat--muted">
              <dt className="page-investimentos-resumo__stat-label">Estimativas</dt>
              <dd className="page-investimentos-resumo__stat-value">A carregar CDI…</dd>
            </div>
          ) : (
            <div className="page-investimentos-resumo__stat page-investimentos-resumo__stat--muted">
              <dt className="page-investimentos-resumo__stat-label">Estimativas</dt>
              <dd className="page-investimentos-resumo__stat-value">CDI indisponível</dd>
            </div>
          )}
        </dl>

        {chartData.length > 0 && (
          <div className="page-investimentos-resumo__chart">
            <p className="page-investimentos-resumo__chart-title">Alocação por tipo</p>
            <DonutChart
              data={chartData}
              colors={CHART_COLORS}
              formatValue={formatCurrencyBRL}
              legendStyle={{ fontSize: '0.75rem', paddingTop: '8px' }}
            />
          </div>
        )}
      </div>

      {/* Barra de diversificação */}
      {diversificacao.length > 1 && (
        <div className="page-investimentos-resumo__diversificacao">
          <p className="page-investimentos-resumo__div-title">Diversificação</p>
          <div className="page-investimentos-resumo__div-bar" aria-label="Barra de diversificação por tipo">
            {diversificacao.map((d) => (
              <div
                key={d.key}
                className="page-investimentos-resumo__div-bar-segment"
                style={{ width: `${d.pct.toFixed(2)}%`, background: TIPO_COLORS[d.key] ?? '#d4a84b' }}
                title={`${d.label}: ${d.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="page-investimentos-resumo__div-legend">
            {diversificacao.map((d) => (
              <div key={d.key} className="page-investimentos-resumo__div-legend-item">
                <span className="page-investimentos-resumo__div-dot" style={{ background: TIPO_COLORS[d.key] ?? '#d4a84b' }} />
                <span className="page-investimentos-resumo__div-label">{d.label}</span>
                <span className="page-investimentos-resumo__div-pct">{d.pct.toFixed(1)}%</span>
                {d.pct > 60 && <span className="page-investimentos-resumo__div-warn" title="Concentração alta">⚠</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de meta da carteira */}
      {metaCarteira && totalInvestidoAtual > 0 && (
        <div className="page-investimentos-resumo__meta">
          <div className="page-investimentos-resumo__meta-head">
            <p className="page-investimentos-resumo__meta-title">Meta da carteira</p>
            <p className="page-investimentos-resumo__meta-values">
              <span>{formatCurrencyBRL(totalInvestidoAtual)}</span>
              <span className="page-investimentos-resumo__meta-sep">/</span>
              <span>{formatCurrencyBRL(metaCarteira)}</span>
              <span className="page-investimentos-resumo__meta-pct">
                ({Math.min((totalInvestidoAtual / metaCarteira) * 100, 100).toFixed(1)}%)
              </span>
            </p>
          </div>
          <div className="page-investimentos-resumo__meta-bar">
            <div
              className="page-investimentos-resumo__meta-fill"
              style={{ width: `${Math.min((totalInvestidoAtual / metaCarteira) * 100, 100).toFixed(2)}%` }}
            />
          </div>
        </div>
      )}

    </article>
    </>
  )
}
