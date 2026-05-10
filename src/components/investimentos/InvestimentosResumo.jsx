import React, { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  estimativaRendimentoAcumuladoAteHoje,
  contarDiasUteisComJurosAteYmd,
  contarDiasUteisComJurosDesdeIso,
  diasCorridosDesdeIso,
  diasCorridosEntreReferenciasIso,
  investimentoIsentoIrPessoaFisica,
  extrairYyyyMmDdReferencia,
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


function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const { name, value } = payload[0].payload
  return (
    <div className="page-investimentos-resumo__tooltip">
      <p className="page-investimentos-resumo__tooltip-name">{name}</p>
      <p className="page-investimentos-resumo__tooltip-value">{formatCurrencyBRL(value)}</p>
    </div>
  )
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

  if (!lista || lista.length === 0 || !stats) return null

  const sufixoData =
    stats.simulacaoAtiva && stats.simulacaoYmd ? ` até ${formatYmdPtBr(stats.simulacaoYmd)}` : ''

  return (
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
          <div className="page-investimentos-resumo__chart" aria-hidden="true">
            <p className="page-investimentos-resumo__chart-title">Alocação por tipo</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="48%"
                  outerRadius="70%"
                  paddingAngle={chartData.length > 1 ? 2 : 0}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: '0.75rem', paddingTop: '8px' }}
                  formatter={(value, entry) => {
                    const total = chartData.reduce((s, d) => s + d.value, 0)
                    const pct = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : '0'
                    return (
                      <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                        {value} · {pct}%
                      </span>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </article>
  )
}
