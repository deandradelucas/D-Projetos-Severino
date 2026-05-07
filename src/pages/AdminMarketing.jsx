import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { SkeletonKpi } from '../components/dashboard/DashboardSkeletons'
import { apiUrl } from '../lib/apiUrl'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import './dashboard.css'

const META_MILHAO = 1_000_000

const MILESTONES = [
  { key: 'conceito', label: 'Prova de Conceito', value: 5_000, icon: '🎯', desc: 'Primeiros pagantes reais — o produto tem valor' },
  { key: 'ramen', label: 'Ramen Profitability', value: 20_000, icon: '🍜', desc: 'MRR cobre os custos básicos do fundador' },
  { key: 'validado', label: 'Produto Validado', value: 100_000, icon: '✅', desc: '500+ assinantes pagantes, churn estável' },
  { key: 'empresa', label: 'Empresa de Verdade', value: 500_000, icon: '🚀', desc: 'Time e marketing pago sustentável' },
  { key: 'milhao', label: 'O Primeiro Milhão', value: 1_000_000, icon: '🏆', desc: 'Marco de 7 dígitos — missão cumprida' },
]

const CANAIS = [
  {
    icon: '🎬',
    canal: 'Reels / TikTok',
    tática: 'Demonstrar WhatsApp Bot em uso real — "anotei meu gasto direto no WhatsApp"',
    cac: 'R$0–50',
    volume: '500–10.000 visitas/mês',
  },
  {
    icon: '🔍',
    canal: 'Google Ads',
    tática: '"alternativa ao Organizze/Mobills" + palavras-chave de dor financeira',
    cac: 'R$35–80',
    volume: '200–800 leads/mês com R$2–3k/mês',
  },
  {
    icon: '🤝',
    canal: 'Afiliados (criadores)',
    tática: 'Criadores de finanças 10k–100k seguidores: R$15 por assinante convertido',
    cac: 'R$10–15',
    volume: '100–500 assinantes/mês por criador',
  },
]

function fmtPct(n) {
  return `${(Number(n || 0) * 100).toFixed(1)}%`
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('pt-BR')
}

function getMilestoneStatus(milestone, receitaTotal) {
  if (receitaTotal >= milestone.value) return 'done'
  if (receitaTotal > 0 && milestone.value > receitaTotal) {
    const prevIdx = MILESTONES.findIndex((m) => m.key === milestone.key)
    const prev = MILESTONES[prevIdx - 1]
    if (!prev || receitaTotal >= prev.value) return 'active'
  }
  return 'pending'
}

function ProgressBar({ percent }) {
  const pct = Math.min(100, Math.max(0, percent || 0))
  return (
    <div className="page-admin-marketing-progress">
      <div
        className="page-admin-marketing-progress__fill"
        style={{ width: `${pct}%`, minWidth: pct > 0 ? 8 : 0 }}
      />
      {pct > 8 ? (
        <span
          className="page-admin-marketing-progress__pct"
          style={{ left: `${Math.min(pct - 2, 92)}%`, transform: 'translate(-50%, -50%)' }}
        >
          {pct.toFixed(2)}%
        </span>
      ) : null}
    </div>
  )
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <article className="ref-kpi-card" style={accent ? { borderTop: `3px solid ${accent}` } : undefined}>
      <div className="ref-kpi-card__body">
        <p className="ref-kpi-card__label">{label}</p>
        <p className="ref-kpi-card__value">{value}</p>
        {sub ? (
          <p className="ref-kpi-card__label" style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>
            {sub}
          </p>
        ) : null}
      </div>
    </article>
  )
}

export default function AdminMarketing() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) {
        setError('Faça login para ver as estatísticas.')
        setStats(null)
        return
      }
      const user = JSON.parse(userSaved)
      const res = await fetch(apiUrl('/api/admin/marketing/stats'), {
        headers: { 'x-user-id': user.id },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.message || `Erro ${res.status} ao carregar dados.`)
        setStats(null)
        return
      }
      setStats(data)
    } catch {
      setError('Falha de rede ao carregar estatísticas.')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  const receitaTotal = stats?.receita_total ?? 0
  const progressoPct = stats?.progresso_percent ?? 0
  const faltam = stats?.faltam ?? META_MILHAO

  return (
    <div className="dashboard-container dashboard-page page-admin page-admin-marketing ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
              <section className="dashboard-hub__hero" aria-label="Marketing — Desafio do Primeiro Milhão">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="dashboard-hub__hero-text">
                    <h1 className="dashboard-hub__title">Marketing</h1>
                    <div className="dashboard-hub__balance-line" aria-live="polite">
                      <span>Desafio do Primeiro Milhão 🏆</span>
                      {!loading && stats ? (
                        <>
                          {' · '}
                          <strong>{fmtNum(stats.total_usuarios)}</strong> cadastros
                          {' · '}
                          <strong>{fmtNum(stats.assinantes_ativos)}</strong> assinantes pagos
                        </>
                      ) : loading ? (
                        <> · Carregando…</>
                      ) : null}
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions page-admin-hero-actions" role="toolbar" aria-label="Atalhos da administração">
                    <Link to="/admin/usuarios" className="dashboard-hub__btn dashboard-hub__btn--secondary">
                      Logs de usuários
                    </Link>
                    <Link to="/admin/pagamentos" className="dashboard-hub__btn dashboard-hub__btn--secondary">
                      Logs de pagamentos
                    </Link>
                    <button
                      type="button"
                      className="dashboard-hub__btn dashboard-hub__btn--primary"
                      onClick={() => void fetchStats()}
                      disabled={loading}
                    >
                      {loading ? 'Atualizando…' : 'Atualizar'}
                    </button>
                  </div>
                </div>
              </section>

              {error ? (
                <div className="page-admin-alert page-admin-alert--error" role="alert">
                  {error}
                </div>
              ) : null}

              <section className="ref-bottom-grid ref-bottom-grid--single page-admin-marketing-stack" aria-label="Indicadores e conteúdo">
                <article className="ref-panel page-admin-marketing-panel">
                  <div className="ref-panel__head">
                    <h2 className="ref-panel__title">Receita acumulada</h2>
                  </div>
                  <div className="page-admin-marketing-panel-body">
                    <div className="page-admin-marketing-meta-row">
                      <div>
                        <div className="page-admin-marketing-meta-row__label">Total aprovado (Asaas)</div>
                        {loading ? (
                          <div
                            style={{
                              height: 40,
                              width: 200,
                              borderRadius: 8,
                              background: 'rgba(148, 163, 184, 0.2)',
                              animation: 'pulse 1.5s ease-in-out infinite',
                            }}
                            aria-hidden
                          />
                        ) : (
                          <div className="page-admin-marketing-meta-row__value">{formatCurrencyBRL(receitaTotal)}</div>
                        )}
                      </div>
                      <div className="page-admin-marketing-meta-row__side">
                        <div className="page-admin-marketing-meta-row__side-label">Meta</div>
                        <div className="page-admin-marketing-meta-row__side-value">R$ 1.000.000</div>
                      </div>
                    </div>

                    <ProgressBar percent={loading ? 0 : progressoPct} />

                    <div className="page-admin-marketing-progress-foot">
                      <span>{loading ? '—' : `Faltam ${formatCurrencyBRL(faltam)}`}</span>
                      <span>{loading ? '—' : `MRR estimado: ${formatCurrencyBRL(stats?.mrr ?? 0)}/mês`}</span>
                    </div>
                  </div>
                </article>

                <article className="ref-panel page-admin-marketing-panel">
                  <div className="ref-panel__head">
                    <h2 className="ref-panel__title">Marcos do desafio</h2>
                  </div>
                  <div className="page-admin-marketing-panel-body">
                    <div className="page-admin-marketing-milestones">
                      {MILESTONES.map((m) => {
                        const status = loading ? 'pending' : getMilestoneStatus(m, receitaTotal)
                        const mod =
                          status === 'done'
                            ? 'page-admin-marketing-milestone--done'
                            : status === 'active'
                              ? 'page-admin-marketing-milestone--active'
                              : 'page-admin-marketing-milestone--pending'
                        return (
                          <div key={m.key} className={`page-admin-marketing-milestone ${mod}`}>
                            <div className="page-admin-marketing-milestone__icon">{m.icon}</div>
                            <div className="page-admin-marketing-milestone__label">{m.label}</div>
                            <div className="page-admin-marketing-milestone__value">{formatCurrencyBRL(m.value)}</div>
                            <div className="page-admin-marketing-milestone__desc">{m.desc}</div>
                            {status === 'done' ? (
                              <div className="page-admin-marketing-milestone__badge page-admin-marketing-milestone__badge--done">
                                ✓ Conquistado
                              </div>
                            ) : null}
                            {status === 'active' ? (
                              <div className="page-admin-marketing-milestone__badge page-admin-marketing-milestone__badge--active">
                                ← Em andamento
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </article>

                <article className="ref-panel page-admin-marketing-panel">
                  <div className="ref-panel__head">
                    <h2 className="ref-panel__title">Métricas de vendas</h2>
                  </div>
                  <div className="page-admin-marketing-panel-body">
                    {loading ? (
                      <div className="ref-kpi-row ref-dashboard-kpi-strip">
                        {[...Array(6)].map((_, i) => (
                          <SkeletonKpi key={i} />
                        ))}
                      </div>
                    ) : (
                      <div className="ref-kpi-row ref-dashboard-kpi-strip">
                        <KpiCard
                          label="MRR"
                          value={formatCurrencyBRL(stats?.mrr ?? 0)}
                          sub="Receita mensal recorrente (estimada)"
                          accent="#6366f1"
                        />
                        <KpiCard
                          label="Assinantes ativos"
                          value={fmtNum(stats?.assinantes_ativos)}
                          sub={`+ ${fmtNum(stats?.isentos)} isentos`}
                          accent="#10b981"
                        />
                        <KpiCard
                          label="Em trial"
                          value={fmtNum(stats?.em_trial)}
                          sub="Potenciais assinantes"
                          accent="#f59e0b"
                        />
                        <KpiCard
                          label="Taxa de conversão"
                          value={fmtPct(stats?.conversion_rate)}
                          sub="Assinantes ÷ (assinantes + trial expirado)"
                          accent="#8b5cf6"
                        />
                        <KpiCard
                          label="Trial expirado"
                          value={fmtNum(stats?.trial_expirado)}
                          sub="Não converteram"
                          accent="#ef4444"
                        />
                        <KpiCard
                          label="Total cadastros"
                          value={fmtNum(stats?.total_usuarios)}
                          sub={`Plano ref.: ${formatCurrencyBRL(stats?.plan_price ?? 0)}/mês`}
                        />
                      </div>
                    )}
                  </div>
                </article>

                <article className="ref-panel page-admin-marketing-panel">
                  <div className="ref-panel__head">
                    <h2 className="ref-panel__title">Funil de conversão</h2>
                  </div>
                  <div className="page-admin-marketing-panel-body">
                    {loading ? (
                      <div
                        style={{
                          height: 60,
                          borderRadius: 8,
                          background: 'rgba(148, 163, 184, 0.2)',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                        aria-hidden
                      />
                    ) : (
                      <>
                        <div className="page-admin-marketing-funnel">
                          {[
                            { label: 'Cadastros', value: stats?.total_usuarios, color: '#6366f1' },
                            { arrow: true },
                            { label: 'Em trial', value: stats?.em_trial, color: '#f59e0b' },
                            { arrow: true },
                            { label: 'Assinantes', value: stats?.assinantes_ativos, color: '#10b981' },
                          ].map((item, idx) =>
                            item.arrow ? (
                              <span key={idx} className="page-admin-marketing-funnel__arrow" aria-hidden>
                                →
                              </span>
                            ) : (
                              <div
                                key={item.label}
                                className="page-admin-marketing-funnel__step"
                                style={{
                                  background: `${item.color}18`,
                                  border: `1.5px solid ${item.color}40`,
                                }}
                              >
                                <div className="page-admin-marketing-funnel__step-num" style={{ color: item.color }}>
                                  {fmtNum(item.value)}
                                </div>
                                <div className="page-admin-marketing-funnel__step-label">{item.label}</div>
                              </div>
                            )
                          )}
                        </div>
                        {stats ? (
                          <p className="page-admin-marketing-funnel-note">
                            <strong>Para bater R$1M acumulado</strong> você precisa de{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                              ~{fmtNum(stats.assinantes_para_meta_mrr)} assinantes
                            </strong>{' '}
                            ao preço de{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {formatCurrencyBRL(stats.plan_price)}/mês
                            </strong>{' '}
                            mantendo-os por 12 meses. Com taxa de conversão atual de{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>{fmtPct(stats.conversion_rate)}</strong>,
                            seriam necessários{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                              ~
                              {stats.conversion_rate > 0
                                ? fmtNum(Math.ceil(stats.assinantes_para_meta_mrr / stats.conversion_rate))
                                : '∞'}{' '}
                              trials
                            </strong>{' '}
                            para atingir a meta (modelo simplificado).
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </article>

                <article className="ref-panel page-admin-marketing-panel">
                  <div className="ref-panel__head">
                    <h2 className="ref-panel__title">Canais de aquisição recomendados</h2>
                  </div>
                  <div className="page-admin-marketing-panel-body">
                    <div className="page-admin-marketing-copy-grid">
                      {CANAIS.map((c) => (
                        <div key={c.canal} className="page-admin-marketing-copy-card">
                          <div style={{ fontSize: 26, marginBottom: 10 }}>{c.icon}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                            {c.canal}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                            {c.tática}
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                            <span>
                              <span style={{ color: 'var(--text-secondary)' }}>CAC: </span>
                              <strong style={{ color: '#10b981' }}>{c.cac}</strong>
                            </span>
                            <span>
                              <span style={{ color: 'var(--text-secondary)' }}>Volume: </span>
                              <strong style={{ color: 'var(--text-primary)' }}>{c.volume}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="ref-panel page-admin-marketing-panel">
                  <div className="ref-panel__head">
                    <h2 className="ref-panel__title">Próximos 30 dias — ações</h2>
                  </div>
                  <div className="page-admin-marketing-panel-body">
                    <ul className="page-admin-marketing-actions-list">
                      {[
                        { prazo: 'Dias 1–3', acao: 'Definir pricing final e validar checkout Asaas em produção' },
                        { prazo: 'Dias 4–7', acao: 'Gravar 3 vídeos demonstrando o WhatsApp Bot em uso real' },
                        { prazo: 'Dias 8–12', acao: 'Oferta beta para contatos: meta de primeiros pagantes' },
                        { prazo: 'Dias 13–18', acao: 'Cadastrar em diretórios como alternativa a apps de finanças' },
                        { prazo: 'Dias 19–24', acao: 'Contatar criadores com proposta de afiliado' },
                        { prazo: 'Dias 25–30', acao: 'Teste pequeno em anúncios — validar copy antes de escalar' },
                      ].map((item) => (
                        <li key={item.prazo}>
                          <span className="page-admin-marketing-actions-list__prazo">{item.prazo}</span>
                          <span className="page-admin-marketing-actions-list__text">{item.acao}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>

                <article className="ref-panel page-admin-marketing-panel">
                  <div className="ref-panel__head">
                    <h2 className="ref-panel__title">Mensagem de vendas</h2>
                  </div>
                  <div className="page-admin-marketing-panel-body">
                    <div className="page-admin-marketing-tagline">
                      <div className="page-admin-marketing-tagline__eyebrow">Tagline principal</div>
                      <div className="page-admin-marketing-tagline__main">
                        &quot;Seu financeiro no WhatsApp. IA que entende seu dinheiro.&quot;
                      </div>
                    </div>
                    <div className="page-admin-marketing-persona-grid">
                      {[
                        {
                          publico: 'Profissional ocupado',
                          copy: 'Anote um gasto no WhatsApp enquanto sai do caixa. O Horizonte categoriza, analisa e te avisa quando está saindo do controle. Sem planilha. Sem app separado.',
                        },
                        {
                          publico: 'Quem quer sair das dívidas',
                          copy: 'Você não controla o dinheiro porque é chato demais. O Horizonte usa IA pra fazer isso por você — e ainda te diz exatamente onde cortar sem afetar sua vida.',
                        },
                        {
                          publico: 'Usuário tech-savvy',
                          copy: 'Organizze é planilha glorificada. Mobills é interface anos 2010. O Horizonte tem biometria, modo dark real, chat com IA usando seus dados reais, e funciona offline.',
                        },
                      ].map((item) => (
                        <div key={item.publico} className="page-admin-marketing-persona">
                          <div className="page-admin-marketing-persona__label">{item.publico}</div>
                          <div className="page-admin-marketing-persona__copy">&quot;{item.copy}&quot;</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              </section>
            </RefDashboardScroll>
          </div>
        </main>
      </div>
    </div>
  )
}
