import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import './dashboard.css'
import './admin-framework.css'

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function TipoBadge({ tipo }) {
  const map = {
    prompt_regra: { label: 'Regra de Prompt', cls: 'badge-prompt' },
    regex_heuristica: { label: 'Regex / Heurística', cls: 'badge-regex' },
    exemplo_treinamento: { label: 'Exemplo de Treino', cls: 'badge-treino' },
  }
  const item = map[tipo] ?? { label: tipo, cls: 'badge-prompt' }
  return <span className={`framework-badge ${item.cls}`}>{item.label}</span>
}

function StatusBadge({ aprovacao, revisadoEm }) {
  if (aprovacao === null || aprovacao === undefined) {
    return <span className="framework-badge badge-pendente">Aguardando</span>
  }
  const data = revisadoEm ? formatDate(revisadoEm) : null
  if (aprovacao) {
    return (
      <span className="framework-badge badge-aprovado">
        Aprovado{data ? ` · ${data}` : ''}
      </span>
    )
  }
  return (
    <span className="framework-badge badge-rejeitado">
      Rejeitado{data ? ` · ${data}` : ''}
    </span>
  )
}

function ExemplosRuins({ exemplos }) {
  if (!Array.isArray(exemplos) || exemplos.length === 0) return null
  return (
    <ul className="framework-exemplos">
      {exemplos.slice(0, 3).map((ex, i) => (
        <li key={i} className="framework-exemplo-item">
          <span className="framework-exemplo-ruim">{ex.titulo_ruim ?? ex.titulo ?? '—'}</span>
          {ex.transcricao ? (
            <span className="framework-exemplo-transcricao">"{ex.transcricao}"</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function PropostaRow({ proposta, onRevisar, salvando }) {
  const pendente = proposta.aprovacao === null || proposta.aprovacao === undefined
  const conteudo = proposta.alteracao_conteudo ?? {}

  return (
    <tr className="framework-row">
      {/* Coluna: Agente */}
      <td className="framework-cell framework-cell--agente">
        <span className="framework-agente-chip">{proposta.agente}</span>
        <span className="framework-date">{formatDate(proposta.created_at)}</span>
      </td>

      {/* Coluna: Alteração */}
      <td className="framework-cell framework-cell--alteracao">
        <div className="framework-alteracao-titulo">{proposta.alteracao_titulo}</div>
        <div className="framework-alteracao-desc">{proposta.alteracao_descricao}</div>
        {(conteudo.before || conteudo.after) && (
          <div className="framework-diff">
            {conteudo.before && (
              <div className="framework-diff-before">
                <strong>Antes:</strong> {conteudo.before}
              </div>
            )}
            {conteudo.after || conteudo.regra_nova ? (
              <div className="framework-diff-after">
                <strong>Depois:</strong> {conteudo.after ?? conteudo.regra_nova}
              </div>
            ) : null}
          </div>
        )}
        <ExemplosRuins exemplos={proposta.exemplos_ruins} />
        <TipoBadge tipo={proposta.alteracao_tipo} />
      </td>

      {/* Coluna: Aprovação */}
      <td className="framework-cell framework-cell--aprovacao">
        {pendente ? (
          <div className="framework-actions">
            <button
              type="button"
              className="framework-btn framework-btn--sim"
              disabled={salvando === proposta.id}
              onClick={() => onRevisar(proposta.id, true)}
            >
              {salvando === proposta.id ? '…' : 'Sim'}
            </button>
            <button
              type="button"
              className="framework-btn framework-btn--nao"
              disabled={salvando === proposta.id}
              onClick={() => onRevisar(proposta.id, false)}
            >
              Não
            </button>
          </div>
        ) : (
          <StatusBadge aprovacao={proposta.aprovacao} revisadoEm={proposta.revisado_em} />
        )}
        {proposta.aplicado && (
          <span className="framework-aplicado-chip">✓ Aplicado</span>
        )}
      </td>
    </tr>
  )
}

export default function AdminFramework() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [tab, setTab] = useState('pendente')
  const [propostas, setPropostas] = useState([])
  const [contagem, setContagem] = useState({ pendente: 0, aprovado: 0, rejeitado: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [salvando, setSalvando] = useState(null)

  const loadContagem = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/api/admin/framework/propostas/contagem'), {})
      if (res.ok) {
        const data = await res.json().catch(() => null)
        if (data) setContagem(data)
      }
    } catch {
      // falha silenciosa — contagem é cosmética
    }
  }, [])

  const loadPropostas = useCallback(async (status) => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch(apiUrl(`/api/admin/framework/propostas?status=${status}`), {})
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.message ?? 'Erro ao carregar propostas.')
        setPropostas([])
        return
      }
      setPropostas(Array.isArray(data) ? data : [])
    } catch {
      setError('Falha de rede ao carregar propostas.')
      setPropostas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadContagem()
  }, [loadContagem])

  useEffect(() => {
    void loadPropostas(tab)
  }, [tab, loadPropostas])

  const handleRevisar = useCallback(async (id, aprovacao) => {
    setSalvando(id)
    try {
      const res = await apiFetch(apiUrl(`/api/admin/framework/propostas/${id}/revisar`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprovacao }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? 'Erro ao revisar proposta.')
        return
      }
      await loadContagem()
      await loadPropostas(tab)
    } catch {
      setError('Falha de rede ao revisar proposta.')
    } finally {
      setSalvando(null)
    }
  }, [tab, loadContagem, loadPropostas])

  const TABS = [
    { key: 'pendente', label: 'Pendente', count: contagem.pendente },
    { key: 'aprovado', label: 'Aprovado', count: contagem.aprovado },
    { key: 'rejeitado', label: 'Rejeitado', count: contagem.rejeitado },
  ]

  return (
    <div className="dashboard-container dashboard-page page-admin page-admin-framework ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
              {/* Hero */}
              <section className="dashboard-hub__hero" aria-label="Framework — Agentes Severino">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="dashboard-hub__hero-text">
                    <h1 className="dashboard-hub__title">Framework</h1>
                    <div className="dashboard-hub__balance-line" aria-live="polite">
                      <span>Propostas pendentes:</span>
                      <strong>{contagem.pendente}</strong>
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions page-admin-hero-actions" role="toolbar">
                    <Link to="/admin/auditoria" className="dashboard-hub__btn dashboard-hub__btn--secondary">
                      Auditoria
                    </Link>
                    <button
                      type="button"
                      className="dashboard-hub__btn dashboard-hub__btn--primary"
                      disabled={loading}
                      onClick={() => { void loadContagem(); void loadPropostas(tab) }}
                    >
                      {loading ? 'Atualizando…' : 'Recarregar'}
                    </button>
                  </div>
                </div>
              </section>

              {error ? <div className="page-admin-alert">{error}</div> : null}

              {/* Card: Agentes Severino */}
              <article className="ref-panel framework-agents-card" aria-labelledby="framework-agents-heading">
                <div className="ref-panel__head">
                  <h2 id="framework-agents-heading" className="ref-panel__title">Agentes Severino</h2>
                  <p className="ref-panel__subtitle">Agentes autônomos que monitoram e melhoram o sistema</p>
                </div>
                <div className="framework-agents-list">
                  <div className="framework-agent-item">
                    <div className="framework-agent-avatar">🤖</div>
                    <div className="framework-agent-info">
                      <span className="framework-agent-handle">@aprendizdaagenda</span>
                      <span className="framework-agent-desc">
                        Monitora extrações de título da Agenda, detecta padrões com erro e propõe melhorias no prompt e nas heurísticas automaticamente.
                      </span>
                      <div className="framework-agent-stats">
                        <span>{contagem.aprovado} regras aprovadas</span>
                        <span>·</span>
                        <span>{contagem.pendente} aguardando revisão</span>
                      </div>
                    </div>
                    <span className="framework-badge badge-ativo">Ativo</span>
                  </div>
                </div>
              </article>

              {/* Tabela de propostas */}
              <article className="ref-panel framework-proposals-card" aria-labelledby="framework-proposals-heading">
                <div className="ref-panel__head">
                  <h2 id="framework-proposals-heading" className="ref-panel__title">Propostas de melhoria</h2>
                  <p className="ref-panel__subtitle">Revise cada sugestão do agente e decida se aplica ou não</p>
                </div>

                {/* Tabs */}
                <div className="framework-tabs" role="tablist">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={tab === t.key}
                      type="button"
                      className={`framework-tab ${tab === t.key ? 'active' : ''}`}
                      onClick={() => setTab(t.key)}
                    >
                      {t.label}
                      {t.count > 0 && (
                        <span className="framework-tab-count">{t.count}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="framework-table-wrap">
                  {loading ? (
                    <p className="framework-empty" aria-busy="true">Carregando…</p>
                  ) : propostas.length === 0 ? (
                    <p className="framework-empty">
                      {tab === 'pendente'
                        ? 'Nenhuma proposta pendente. O agente ainda não identificou padrões para melhorar.'
                        : `Nenhuma proposta ${tab}.`}
                    </p>
                  ) : (
                    <table className="framework-table" aria-label="Propostas do agente">
                      <thead>
                        <tr>
                          <th className="framework-th framework-th--agente">Agente</th>
                          <th className="framework-th framework-th--alteracao">Alteração</th>
                          <th className="framework-th framework-th--aprovacao">Aprovação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {propostas.map((p) => (
                          <PropostaRow
                            key={p.id}
                            proposta={p}
                            onRevisar={handleRevisar}
                            salvando={salvando}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </article>
            </RefDashboardScroll>
          </div>
        </main>
      </div>
    </div>
  )
}
