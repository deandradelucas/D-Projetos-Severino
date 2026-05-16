import React from 'react'
import { SkeletonKpi } from '../dashboard/DashboardSkeletons'
import { formatCurrencyBRL } from '../../lib/formatCurrency'

export default function AdminUsuariosKpis({ stats, loading }) {
  if (loading && !stats) {
    return (
      <>
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi />
      </>
    )
  }

  if (!stats) return null

  return (
    <>
      <article className="ref-kpi-card ref-kpi-card--balance">
        <div className="ref-kpi-card__icon" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="ref-kpi-card__body">
          <p className="ref-kpi-card__label">Total de cadastros</p>
          <p className="ref-kpi-card__value">{stats.total}</p>
        </div>
      </article>
      <article className="ref-kpi-card ref-kpi-card--income">
        <div className="ref-kpi-card__icon" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div className="ref-kpi-card__body">
          <p className="ref-kpi-card__label">Contas ativas</p>
          <p className="ref-kpi-card__value">{stats.ativos}</p>
        </div>
      </article>
      <article className="ref-kpi-card ref-kpi-card--expense">
        <div className="ref-kpi-card__icon" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="ref-kpi-card__body">
          <p className="ref-kpi-card__label">Administradores</p>
          <p className="ref-kpi-card__value">{stats.admins}</p>
        </div>
      </article>
      <article className="ref-kpi-card">
        <div className="ref-kpi-card__icon" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
        </div>
        <div className="ref-kpi-card__body">
          <p className="ref-kpi-card__label">Assinaturas pagas</p>
          <p className="ref-kpi-card__value">{stats.assinaturas_pagas}</p>
        </div>
      </article>
      <article className="ref-kpi-card ref-kpi-card--income">
        <div className="ref-kpi-card__icon" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" x2="12" y1="2" y2="22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div className="ref-kpi-card__body">
          <p className="ref-kpi-card__label">Receita no mês</p>
          <p className="ref-kpi-card__value">{formatCurrencyBRL(stats.receita_mensal_total ?? 0)}</p>
        </div>
      </article>
    </>
  )
}
