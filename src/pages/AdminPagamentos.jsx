import React, { useCallback, useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import AdminPaymentLogsPanel from '../components/admin/AdminPaymentLogsPanel'
import { apiUrl } from '../lib/apiUrl'
import { buildPaymentLogsQuery, normalizePaymentLogsResponse } from '../lib/paymentLogsAdmin'
import './dashboard.css'

const ADMIN_DOCS_URL = import.meta.env.VITE_ADMIN_DOCS_URL || ''

const DEFAULT_LOAD = {
  limit: 500,
  q: '',
  statusGroup: 'all',
  dateFrom: '',
  dateTo: '',
  sort: 'created_desc',
  exempt: 'all',
  overdueOnly: false,
}

export default function AdminPagamentos() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loadParams, setLoadParams] = useState(() => ({ ...DEFAULT_LOAD }))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [togglingUserId, setTogglingUserId] = useState(null)
  const [deletingPending, setDeletingPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) return
      const u = JSON.parse(userSaved)
      const qs = buildPaymentLogsQuery(loadParams)
      const res = await fetch(apiUrl(`/api/admin/pagamentos?${qs}`), { headers: { 'x-user-id': u.id } })
      if (!res.ok) throw new Error('Falha ao carregar logs de pagamento.')
      const data = await res.json()
      const { rows: nextRows, summary: nextSummary } = normalizePaymentLogsResponse(data)
      setRows(nextRows)
      setSummary(nextSummary)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [loadParams])

  useEffect(() => {
    load()
  }, [load])

  const alternarIsencao = async (usuarioId, proximo) => {
    if (!usuarioId) return
    setActionMsg('')
    setTogglingUserId(usuarioId)
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl(`/api/admin/usuarios/${usuarioId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': u.id,
        },
        body: JSON.stringify({ isento_pagamento: proximo }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Não foi possível atualizar a isenção.')
      setRows((prev) =>
        prev.map((r) => {
          if (r.usuario_id !== usuarioId) return r
          const rel = r.usuarios
          const base = { ...r, isExempt: proximo }
          if (rel && typeof rel === 'object' && !Array.isArray(rel)) {
            return { ...base, usuarios: { ...rel, isento_pagamento: proximo } }
          }
          return {
            ...base,
            usuarios: { email: '', nome: '', isento_pagamento: proximo },
          }
        })
      )
      setActionMsg(proximo ? 'Usuário marcado como isento de pagamento.' : 'Isenção removida.')
    } catch (e) {
      setActionMsg(e.message || 'Erro ao salvar.')
    } finally {
      setTogglingUserId(null)
    }
  }

  const handleExcluirLogsPendentes = async () => {
    if (
      !window.confirm(
        'Excluir todos os registros cujo status no Mercado Pago está pendente, em processamento ou em mediação? ' +
          'Aprovados, recusados e estornados não serão removidos. Esta ação não pode ser desfeita.'
      )
    ) {
      return
    }
    setDeletingPending(true)
    setActionMsg('')
    setError('')
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl('/api/admin/pagamentos/pendentes'), {
        method: 'DELETE',
        headers: { 'x-user-id': u.id },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Falha ao excluir logs pendentes.')
      setActionMsg(data.message || (data.deleted ? `${data.deleted} registro(s) excluído(s).` : 'Nenhum registro pendente.'))
      await load()
    } catch (e) {
      setError(e.message || 'Erro ao excluir.')
    } finally {
      setDeletingPending(false)
    }
  }

  return (
    <div className="dashboard-container page-admin ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <section className="dashboard-hub__hero page-admin__hero" aria-label="Logs de pagamentos">
              <div className="dashboard-hub__hero-row">
                <MobileMenuButton onClick={() => setMenuAberto(true)} />
                <div className="dashboard-hub__hero-text">
                  <h1 className="dashboard-hub__title">Logs de Pagamentos</h1>
                  <p className="ref-panel__subtitle page-admin-header-sub">
                    Acompanhe preferências, cobranças, status e receita gerada pelo Mercado Pago.
                  </p>
                </div>
              </div>
            </section>

            <RefDashboardScroll>
            <AdminPaymentLogsPanel
              rows={rows}
              summary={summary}
              loading={loading}
              error={error}
              actionMsg={actionMsg}
              loadParams={loadParams}
              onLoadParamsChange={setLoadParams}
              onRefresh={() => void load()}
              onDeletePending={() => void handleExcluirLogsPendentes()}
              deletingPending={deletingPending}
              togglingUserId={togglingUserId}
              onToggleExempt={alternarIsencao}
              adminDocsUrl={ADMIN_DOCS_URL}
            />
            </RefDashboardScroll>
          </div>
        </main>
      </div>
    </div>
  )
}
