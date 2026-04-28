import React, { useMemo, useState } from 'react'
import AdminDataTableSkeleton from '../AdminDataTableSkeleton'
import PaymentLogStatusBadge from './PaymentLogStatusBadge'
import {
  computeOperationalInsights,
  daysUntilLabel,
  exportPaymentLogsCsv,
  filterPaymentLogsClient,
  formatCurrencyBRL,
  formatDatePt,
  formatDateTimePt,
  downloadTextFile,
  sortPaymentLogRows,
} from '../../lib/paymentLogsAdmin'

const TABLE_HEADERS = [
  'Registro',
  'Usuário',
  'E-mail',
  'ID usuário',
  'Valor',
  'Status',
  'Isenção',
  'Venc. / próx. cobrança',
  'Último pag.',
  'Provedor',
  'ID pagamento',
  'Referência',
  'Detalhe',
  'Ações',
]

/**
 * @param {{
 *   rows: any[]
 *   summary: Record<string, any> | null
 *   loading: boolean
 *   error: string
 *   actionMsg: string
 *   loadParams: Record<string, any>
 *   onLoadParamsChange: (next: Record<string, any>) => void
 *   onRefresh: () => void
 *   onDeletePending: () => void
 *   deletingPending: boolean
 *   togglingUserId: string | null
 *   onToggleExempt: (usuarioId: string, proximo: boolean) => void
 *   adminDocsUrl?: string
 * }} props
 */
export default function AdminPaymentLogsPanel({
  rows,
  summary,
  loading,
  error,
  actionMsg,
  loadParams,
  onLoadParamsChange,
  onRefresh,
  onDeletePending,
  deletingPending,
  togglingUserId,
  onToggleExempt,
  adminDocsUrl = '',
}) {
  const [detail, setDetail] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [clientFilters, setClientFilters] = useState({
    amountMin: '',
    amountMax: '',
    dueFrom: '',
    dueTo: '',
    payFrom: '',
    payTo: '',
  })

  const clientFiltered = useMemo(
    () => filterPaymentLogsClient(rows, clientFilters),
    [rows, clientFilters]
  )

  const sortedRows = useMemo(
    () => sortPaymentLogRows(clientFiltered, loadParams.sort || 'created_desc'),
    [clientFiltered, loadParams.sort]
  )

  const insights = useMemo(() => computeOperationalInsights(rows, summary), [rows, summary])

  const handleExportCsv = () => {
    setExporting(true)
    try {
      const text = exportPaymentLogsCsv(sortedRows)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadTextFile(`logs-pagamentos-${stamp}.csv`, `\uFEFF${text}`)
    } finally {
      setExporting(false)
    }
  }

  const setParam = (key, value) => {
    onLoadParamsChange({ ...loadParams, [key]: value })
  }

  const clearServerFilters = () => {
    onLoadParamsChange({
      ...loadParams,
      q: '',
      statusGroup: 'all',
      dateFrom: '',
      dateTo: '',
      sort: 'created_desc',
      exempt: 'all',
      overdueOnly: false,
    })
    setClientFilters({ amountMin: '', amountMax: '', dueFrom: '', dueTo: '', payFrom: '', payTo: '' })
  }

  return (
    <>
      <article
        className="ref-panel page-admin-ref-panel page-admin-ref-panel--table page-admin-payment-logs"
        aria-labelledby="admin-pag-heading"
      >
        <div className="ref-panel__head page-admin-pagamentos-panel-head page-admin-payment-logs__head">
          <div>
            <h2 id="admin-pag-heading" className="ref-panel__title">
              Registros e indicadores
            </h2>
            <p className="ref-panel__subtitle">
              Preferências Mercado Pago, status de cobrança, isenções e receita aprovada — filtros combinam com o período do registro.
            </p>
          </div>
          <div className="page-admin-payment-logs__head-actions">
            <button type="button" className="btn-secondary page-admin-toolbar-btn" disabled={loading} onClick={() => onRefresh()}>
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
            <button type="button" className="btn-secondary page-admin-toolbar-btn" disabled={loading || exporting} onClick={() => handleExportCsv()}>
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
            <button
              type="button"
              className="btn-secondary page-admin-btn-danger-outline"
              disabled={loading || deletingPending}
              onClick={() => void onDeletePending()}
            >
              {deletingPending ? 'Excluindo…' : 'Excluir logs pendentes'}
            </button>
          </div>
        </div>

        {error ? <div className="page-admin-alert">{error}</div> : null}
        {actionMsg ? <div className="page-admin-toast-msg">{actionMsg}</div> : null}

        {summary && !loading && (
          <div className="page-admin-kpi-compact-strip" style={{ marginBottom: '16px' }}>
            <div className="kpi-mini"><span>Aprovado:</span> <strong>{formatCurrencyBRL(summary.accumulatedRevenue)}</strong></div>
            <div className="kpi-mini"><span>Qtde:</span> <strong>{summary.approvedCount}</strong></div>
            <div className="kpi-mini"><span>Pendente:</span> <strong>{formatCurrencyBRL(summary.pendingAmount)}</strong></div>
            <div className="kpi-mini"><span>Atrasados:</span> <strong>{summary.overdueCount ?? 0}</strong></div>
            <div className="kpi-mini kpi-mini--accent"><span>Mês:</span> <strong>{formatCurrencyBRL(summary.monthlyRevenue ?? 0)}</strong></div>
          </div>
        )}

        {summary?.summaryTruncated ? (
          <p className="page-admin-payment-logs__hint" role="status">
            Resumo calculado sobre os primeiros registros do filtro — refine a busca para auditoria completa.
          </p>
        ) : null}

        <div className="page-admin-payment-logs__layout">
          <div className="page-admin-payment-logs__main">
            <div className="page-admin-users-toolbar page-admin-users-toolbar--grid page-admin-payment-logs__toolbar">
              <div className="page-admin-search-wrap">
                <span className="page-admin-search-icon" aria-hidden>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  type="search"
                  className="page-admin-filter-input page-admin-filter-input--search"
                  placeholder="Usuário, e-mail, ID, referência ou ID MP…"
                  value={loadParams.q || ''}
                  onChange={(e) => setParam('q', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onRefresh()
                  }}
                  autoComplete="off"
                />
              </div>
              <label className="page-admin-filter-label">
                <span>Status</span>
                <select className="page-admin-filter-select" value={loadParams.statusGroup || 'all'} onChange={(e) => setParam('statusGroup', e.target.value)}>
                  <option value="all">Todos</option>
                  <option value="approved">Aprovados</option>
                  <option value="pending">Pendentes</option>
                  <option value="rejected">Recusados / cancelados</option>
                  <option value="refunded">Estornos / chargeback</option>
                </select>
              </label>
              <label className="page-admin-filter-label">
                <span>Isenção</span>
                <select className="page-admin-filter-select" value={loadParams.exempt || 'all'} onChange={(e) => setParam('exempt', e.target.value)}>
                  <option value="all">Todas</option>
                  <option value="yes">Isentos</option>
                  <option value="no">Não isentos</option>
                </select>
              </label>
              <label className="page-admin-filter-label">
                <span>Ordenar</span>
                <select className="page-admin-filter-select" value={loadParams.sort || 'created_desc'} onChange={(e) => setParam('sort', e.target.value)}>
                  <option value="created_desc">Data ↓</option>
                  <option value="created_asc">Data ↑</option>
                  <option value="amount_desc">Valor ↓</option>
                  <option value="amount_asc">Valor ↑</option>
                  <option value="status_asc">Status A–Z</option>
                  <option value="status_desc">Status Z–A</option>
                </select>
              </label>
              <label className="page-admin-filter-label">
                <span>Período (registro)</span>
                <input
                  type="date"
                  className="page-admin-filter-input"
                  value={loadParams.dateFrom || ''}
                  onChange={(e) => setParam('dateFrom', e.target.value)}
                />
              </label>
              <label className="page-admin-filter-label">
                <span>Até</span>
                <input type="date" className="page-admin-filter-input" value={loadParams.dateTo || ''} onChange={(e) => setParam('dateTo', e.target.value)} />
              </label>
              <div className="page-admin-payment-logs__quick-filters">
                <button
                  type="button"
                  className={`btn-secondary page-admin-toolbar-btn${loadParams.statusGroup === 'pending' ? ' page-admin-toolbar-btn--active' : ''}`}
                  onClick={() => setParam('statusGroup', loadParams.statusGroup === 'pending' ? 'all' : 'pending')}
                >
                  Só pendentes
                </button>
                <button
                  type="button"
                  className={`btn-secondary page-admin-toolbar-btn${loadParams.overdueOnly ? ' page-admin-toolbar-btn--active' : ''}`}
                  onClick={() => onLoadParamsChange({ ...loadParams, overdueOnly: !loadParams.overdueOnly })}
                >
                  Só atrasados
                </button>
              </div>
              <div className="page-admin-toolbar-btns">
                <button type="button" className="btn-secondary page-admin-toolbar-btn" disabled={loading} onClick={() => onRefresh()}>
                  Aplicar filtros
                </button>
                <button type="button" className="btn-secondary page-admin-toolbar-btn" onClick={clearServerFilters}>
                  Limpar filtros
                </button>
              </div>
            </div>

            <div className="page-admin-payment-logs__client-filters">
              <p className="page-admin-payment-logs__client-filters-title">Refinar no lote carregado</p>
              <div className="page-admin-payment-logs__client-filters-grid">
                <label className="page-admin-filter-label">
                  <span>Valor mín. (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="page-admin-filter-input"
                    value={clientFilters.amountMin}
                    onChange={(e) => setClientFilters((p) => ({ ...p, amountMin: e.target.value }))}
                  />
                </label>
                <label className="page-admin-filter-label">
                  <span>Valor máx. (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="page-admin-filter-input"
                    value={clientFilters.amountMax}
                    onChange={(e) => setClientFilters((p) => ({ ...p, amountMax: e.target.value }))}
                  />
                </label>
                <label className="page-admin-filter-label">
                  <span>Venc. / próx. cobrança de</span>
                  <input
                    type="date"
                    className="page-admin-filter-input"
                    value={clientFilters.dueFrom}
                    onChange={(e) => setClientFilters((p) => ({ ...p, dueFrom: e.target.value }))}
                  />
                </label>
                <label className="page-admin-filter-label">
                  <span>até</span>
                  <input
                    type="date"
                    className="page-admin-filter-input"
                    value={clientFilters.dueTo}
                    onChange={(e) => setClientFilters((p) => ({ ...p, dueTo: e.target.value }))}
                  />
                </label>
                <label className="page-admin-filter-label">
                  <span>Último pag. de</span>
                  <input
                    type="date"
                    className="page-admin-filter-input"
                    value={clientFilters.payFrom}
                    onChange={(e) => setClientFilters((p) => ({ ...p, payFrom: e.target.value }))}
                  />
                </label>
                <label className="page-admin-filter-label">
                  <span>até</span>
                  <input
                    type="date"
                    className="page-admin-filter-input"
                    value={clientFilters.payTo}
                    onChange={(e) => setClientFilters((p) => ({ ...p, payTo: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div className="page-admin-table-scroll page-admin-payment-logs__table-wrap">
              {loading ? (
                <AdminDataTableSkeleton headers={TABLE_HEADERS} rows={8} />
              ) : sortedRows.length === 0 ? (
                <p className="page-admin-empty">Nenhum pagamento encontrado com estes filtros.</p>
              ) : (
                <>
                  <table className="data-table page-admin-data-table page-admin-payment-logs__table-desktop">
                    <thead>
                      <tr>
                        {TABLE_HEADERS.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((row) => (
                        <tr
                          key={row.id}
                          className={row.isOverdue ? 'page-admin-payment-logs__row--alert' : undefined}
                          onClick={() => setDetail(row)}
                        >
                          <td className="page-admin-payment-logs__cell-muted">{formatDateTimePt(row.created_at)}</td>
                          <td className="page-admin-cell-strong">{row.userName || '—'}</td>
                          <td className="page-admin-payment-logs__cell-email">{row.userEmail || '—'}</td>
                          <td className="page-admin-payment-logs__cell-mono">{row.usuario_id ? String(row.usuario_id).slice(0, 10) : '—'}</td>
                          <td>{formatCurrencyBRL(row.amount)}</td>
                          <td>
                            <PaymentLogStatusBadge status={row.status} isOverdue={row.isOverdue} />
                          </td>
                          <td>
                            {row.usuario_id ? (
                              <span className={row.isExempt ? 'admin-pill' : 'admin-pill page-admin-payment-logs__pill--muted'}>
                                {row.isExempt ? 'Isento' : 'Não'}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="page-admin-payment-logs__cell-muted">
                            <span title={row.dueDate || row.nextPaymentDate || ''}>{formatDatePt(row.dueDate || row.nextPaymentDate)}</span>
                            <span className="page-admin-payment-logs__sub">{daysUntilLabel(row.nextPaymentDate || row.dueDate)}</span>
                          </td>
                          <td className="page-admin-payment-logs__cell-muted">{formatDateTimePt(row.lastPaymentDate)}</td>
                          <td>
                            <span className="page-admin-payment-logs__provider">{row.provider || '—'}</span>
                          </td>
                          <td className="page-admin-payment-logs__cell-mono">{row.payment_id || '—'}</td>
                          <td className="page-admin-payment-logs__cell-mono">{row.external_reference || '—'}</td>
                          <td className="page-admin-payment-logs__cell-detail">{row.status_detail || row.description || '—'}</td>
                          <td className="page-admin-payment-logs__actions" onClick={(e) => e.stopPropagation()}>
                            <div className="page-admin-payment-logs__actions-inner">
                              <button
                                type="button"
                                className="btn-secondary page-admin-payment-logs__action-btn"
                                onClick={() => setDetail(row)}
                              >
                                Detalhes
                              </button>
                              {row.usuario_id ? (
                                <button
                                  type="button"
                                  className="btn-secondary page-admin-payment-logs__action-btn"
                                  disabled={togglingUserId === row.usuario_id}
                                  onClick={() => onToggleExempt(row.usuario_id, !row.isExempt)}
                                >
                                  {togglingUserId === row.usuario_id ? '…' : row.isExempt ? 'Remover isenção' : 'Isentar'}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <ul className="page-admin-payment-logs__mobile-list">
                    {sortedRows.map((row) => (
                      <li key={row.id}>
                        <button type="button" className="page-admin-payment-logs__mobile-card" onClick={() => setDetail(row)}>
                          <div className="page-admin-payment-logs__mobile-top">
                            <span className="page-admin-payment-logs__mobile-amount">{formatCurrencyBRL(row.amount)}</span>
                            <PaymentLogStatusBadge status={row.status} isOverdue={row.isOverdue} />
                          </div>
                          <p className="page-admin-payment-logs__mobile-user">{row.userName || row.userEmail || row.usuario_id || '—'}</p>
                          <p className="page-admin-payment-logs__mobile-meta">{formatDateTimePt(row.created_at)}</p>
                          {row.isExempt ? <span className="admin-pill">Isento</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <aside className="page-admin-payment-logs__aside" aria-label="Insights operacionais">
            <div className="page-admin-payment-logs__aside-card">
              <h3 className="page-admin-payment-logs__aside-title">Operação</h3>
              <ul className="page-admin-payment-logs__aside-list">
                <li>
                  <span className="page-admin-payment-logs__aside-k">Vencendo hoje (próx. cobrança)</span>
                  <span className="page-admin-payment-logs__aside-v">{insights.dueToday}</span>
                </li>
                <li>
                  <span className="page-admin-payment-logs__aside-k">Próximos 7 dias</span>
                  <span className="page-admin-payment-logs__aside-v">{insights.due7}</span>
                </li>
                <li>
                  <span className="page-admin-payment-logs__aside-k">Pendências que exigem atenção</span>
                  <span className="page-admin-payment-logs__aside-v">{insights.pendingAction}</span>
                </li>
                <li>
                  <span className="page-admin-payment-logs__aside-k">Atrasados (&gt;7d pendente)</span>
                  <span className="page-admin-payment-logs__aside-v">{summary?.overdueCount ?? '—'}</span>
                </li>
              </ul>
            </div>
            <div className="page-admin-payment-logs__aside-card">
              <h3 className="page-admin-payment-logs__aside-title">Gestão</h3>
              <ul className="page-admin-payment-logs__aside-list">
                <li>
                  <span className="page-admin-payment-logs__aside-k">Receita no mês (aprovados)</span>
                  <span className="page-admin-payment-logs__aside-v">{formatCurrencyBRL(summary?.monthlyRevenue ?? 0)}</span>
                </li>
                <li>
                  <span className="page-admin-payment-logs__aside-k">Ticket médio (aprov.)</span>
                  <span className="page-admin-payment-logs__aside-v">{formatCurrencyBRL(summary?.ticketMedio ?? 0)}</span>
                </li>
                <li>
                  <span className="page-admin-payment-logs__aside-k">Taxa de aprovação</span>
                  <span className="page-admin-payment-logs__aside-v">
                    {insights.approvalRate != null ? `${insights.approvalRate}%` : '—'}
                  </span>
                </li>
                <li>
                  <span className="page-admin-payment-logs__aside-k">Isentos (usuários no lote)</span>
                  <span className="page-admin-payment-logs__aside-v">{insights.exemptCount}</span>
                </li>
                <li>
                  <span className="page-admin-payment-logs__aside-k">Recusados / cancelados</span>
                  <span className="page-admin-payment-logs__aside-v">{summary?.rejectedCount ?? '—'}</span>
                </li>
                <li>
                  <span className="page-admin-payment-logs__aside-k">Estornos</span>
                  <span className="page-admin-payment-logs__aside-v">{summary?.refundedCount ?? '—'}</span>
                </li>
              </ul>
            </div>
            {adminDocsUrl ? (
              <div className="page-admin-payment-logs__aside-card page-admin-payment-logs__aside-card--muted">
                <a className="page-admin-doc-link" href={adminDocsUrl} target="_blank" rel="noreferrer">
                  Documentação / runbook
                </a>
              </div>
            ) : null}
          </aside>
        </div>
      </article>

      {detail ? (
        <div
          className="modal-backdrop page-admin-payment-logs-modal-backdrop"
          role="presentation"
          onClick={() => setDetail(null)}
        >
          <div
            className="modal-content page-admin-payment-logs-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-log-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="page-admin-payment-logs-modal__head">
              <h3 id="payment-log-detail-title">Detalhe do pagamento</h3>
              <button type="button" className="page-admin-payment-logs-modal__close" onClick={() => setDetail(null)} aria-label="Fechar">
                ×
              </button>
            </div>
            <div className="page-admin-payment-logs-modal__body">
              <dl className="page-admin-payment-logs-detail-dl">
                <dt>Usuário</dt>
                <dd>{detail.userName || '—'}</dd>
                <dt>E-mail</dt>
                <dd>{detail.userEmail || '—'}</dd>
                <dt>ID do usuário</dt>
                <dd className="page-admin-payment-logs__cell-mono">{detail.usuario_id || '—'}</dd>
                <dt>Valor</dt>
                <dd>{formatCurrencyBRL(detail.amount)}</dd>
                <dt>Status</dt>
                <dd>
                  <PaymentLogStatusBadge status={detail.status} isOverdue={detail.isOverdue} />
                </dd>
                <dt>Assinatura (MP)</dt>
                <dd>{detail.subscriptionStatus || '—'}</dd>
                <dt>Registro</dt>
                <dd>{formatDateTimePt(detail.created_at)}</dd>
                <dt>Último pagamento / atualização</dt>
                <dd>{formatDateTimePt(detail.lastPaymentDate)}</dd>
                <dt>Data de vencimento (MP)</dt>
                <dd>{formatDateTimePt(detail.dueDate)}</dd>
                <dt>Próxima cobrança</dt>
                <dd>{formatDateTimePt(detail.nextPaymentDate)}</dd>
                <dt>Método</dt>
                <dd>{detail.paymentMethod || '—'}</dd>
                <dt>Provedor</dt>
                <dd>{detail.provider || '—'}</dd>
                <dt>Ciclo</dt>
                <dd>{detail.billingCycle || '—'}</dd>
                <dt>ID pagamento</dt>
                <dd className="page-admin-payment-logs__cell-mono">{detail.payment_id || '—'}</dd>
                <dt>Preferência</dt>
                <dd className="page-admin-payment-logs__cell-mono">{detail.preference_id || '—'}</dd>
                <dt>Referência externa</dt>
                <dd className="page-admin-payment-logs__cell-mono">{detail.external_reference || '—'}</dd>
                <dt>Motivo / detalhe</dt>
                <dd>{detail.failureReason || detail.status_detail || '—'}</dd>
                <dt>Tentativas / parcelas</dt>
                <dd>{detail.attemptCount != null ? String(detail.attemptCount) : '—'}</dd>
                <dt>Isenção</dt>
                <dd>{detail.isExempt ? 'Sim' : 'Não'}</dd>
                <dt>Observações</dt>
                <dd>{detail.notes || detail.description || '—'}</dd>
              </dl>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
