import React from 'react'
import { ROLE_OPTIONS } from '../../lib/adminUsuariosUtils.js'

export default function AdminUsuariosFilters({
  userFilter,
  setUserFilter,
  filterRole,
  setFilterRole,
  filterConta,
  setFilterConta,
  filterSort,
  setFilterSort,
  filterAssinatura,
  setFilterAssinatura,
  filterLogin,
  setFilterLogin,
  filterCreatedFrom,
  setFilterCreatedFrom,
  filterCreatedTo,
  setFilterCreatedTo,
  filterAccessFrom,
  setFilterAccessFrom,
  filterAccessTo,
  setFilterAccessTo,
  filterPayFrom,
  setFilterPayFrom,
  filterPayTo,
  setFilterPayTo,
  filterTrialEndsFrom,
  setFilterTrialEndsFrom,
  filterTrialEndsTo,
  setFilterTrialEndsTo,
  onClearFilters,
}) {
  return (
    <div
      id="admin-users-filters-region"
      className="page-admin-usuarios-filters-region"
      role="region"
      aria-labelledby="admin-users-filters-disclosure"
    >
      <div className="page-admin-users-toolbar page-admin-users-toolbar--grid">
        <div className="page-admin-search-wrap">
          <span className="page-admin-search-icon" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            className="page-admin-filter-input page-admin-filter-input--search"
            placeholder="Buscar nome, e-mail, telefone ou id…"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            autoComplete="off"
          />
        </div>
        <label className="page-admin-filter-label">
          <span>Papel</span>
          <select className="page-admin-filter-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">Todos</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="page-admin-filter-label">
          <span>Conta</span>
          <select className="page-admin-filter-select" value={filterConta} onChange={(e) => setFilterConta(e.target.value)}>
            <option value="">Todas</option>
            <option value="ativo">Ativa</option>
            <option value="inativo">Desativada</option>
          </select>
        </label>
        <label className="page-admin-filter-label">
          <span>Ordenar</span>
          <select className="page-admin-filter-select" value={filterSort} onChange={(e) => setFilterSort(e.target.value)}>
            <option value="email_asc">E-mail A–Z</option>
            <option value="email_desc">E-mail Z–A</option>
            <option value="nome_asc">Nome A–Z</option>
            <option value="nome_desc">Nome Z–A</option>
            <option value="last_login_desc">Último acesso ↓</option>
            <option value="last_login_asc">Último acesso ↑</option>
            <option value="trial_asc">Venc. trial ↑</option>
            <option value="trial_desc">Venc. trial ↓</option>
            <option value="next_pay_asc">Próx. cobrança ↑</option>
            <option value="next_pay_desc">Próx. cobrança ↓</option>
            <option value="revenue_desc">Ganho acumulado ↓</option>
            <option value="revenue_asc">Ganho acumulado ↑</option>
            <option value="created_desc">Cadastro ↓</option>
            <option value="created_asc">Cadastro ↑</option>
          </select>
        </label>
        <label className="page-admin-filter-label">
          <span>Assinatura</span>
          <select className="page-admin-filter-select" value={filterAssinatura} onChange={(e) => setFilterAssinatura(e.target.value)}>
            <option value="">Todas</option>
            <option value="pago">Com pagamento aprovado</option>
            <option value="nao_pago">Sem pagamento aprovado</option>
            <option value="trial">Em trial</option>
            <option value="isento">Isentos</option>
            <option value="inadimplente">Inadimplentes (trial vencido)</option>
          </select>
        </label>
        <label className="page-admin-filter-label">
          <span>Acesso</span>
          <select className="page-admin-filter-select" value={filterLogin} onChange={(e) => setFilterLogin(e.target.value)}>
            <option value="">Qualquer</option>
            <option value="nunca">Nunca acessou</option>
            <option value="stale">Sem login há 30 dias</option>
          </select>
        </label>
        <div className="page-admin-toolbar-btns">
          <button type="button" className="btn-secondary page-admin-toolbar-btn" onClick={onClearFilters}>
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="page-admin-usuarios-adv-filters">
        <p className="page-admin-usuarios-adv-title">Períodos e datas</p>
        <div className="page-admin-usuarios-adv-grid">
          <label className="page-admin-filter-label">
            <span>Cadastro de</span>
            <input
              type="date"
              className="page-admin-filter-input"
              value={filterCreatedFrom}
              onChange={(e) => setFilterCreatedFrom(e.target.value)}
            />
          </label>
          <label className="page-admin-filter-label">
            <span>até</span>
            <input type="date" className="page-admin-filter-input" value={filterCreatedTo} onChange={(e) => setFilterCreatedTo(e.target.value)} />
          </label>
          <label className="page-admin-filter-label">
            <span>Último acesso de</span>
            <input
              type="date"
              className="page-admin-filter-input"
              value={filterAccessFrom}
              onChange={(e) => setFilterAccessFrom(e.target.value)}
            />
          </label>
          <label className="page-admin-filter-label">
            <span>até</span>
            <input type="date" className="page-admin-filter-input" value={filterAccessTo} onChange={(e) => setFilterAccessTo(e.target.value)} />
          </label>
          <label className="page-admin-filter-label">
            <span>Próx. cobrança de</span>
            <input type="date" className="page-admin-filter-input" value={filterPayFrom} onChange={(e) => setFilterPayFrom(e.target.value)} />
          </label>
          <label className="page-admin-filter-label">
            <span>até</span>
            <input type="date" className="page-admin-filter-input" value={filterPayTo} onChange={(e) => setFilterPayTo(e.target.value)} />
          </label>
          <label className="page-admin-filter-label">
            <span>Fim do trial de</span>
            <input
              type="date"
              className="page-admin-filter-input"
              value={filterTrialEndsFrom}
              onChange={(e) => setFilterTrialEndsFrom(e.target.value)}
            />
          </label>
          <label className="page-admin-filter-label">
            <span>até</span>
            <input
              type="date"
              className="page-admin-filter-input"
              value={filterTrialEndsTo}
              onChange={(e) => setFilterTrialEndsTo(e.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
