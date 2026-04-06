import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'

export default function Dashboard() {
  const [usuario] = useState(() => {
    const saved = localStorage.getItem('horizonte_user')
    if (saved) {
      try {
        return JSON.parse(saved) || { nome: 'Usuário', email: '' }
      } catch (e) {
        console.error('Error parsing user', e)
      }
    }
    return { nome: 'Usuário', email: '' }
  })
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="dashboard-container">
      {/* Mobile Backdrop */}
      {menuAberto && (
        <div className="mobile-backdrop" onClick={() => setMenuAberto(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="brand-wrapper">
          <img 
            src="/images/horizonte_fiel_original_logo_dark.png" 
            alt="Horizonte Financeiro" 
            className="brand-logo" 
            onError={(e) => { e.target.src = '/images/horizonte_fiel_original_logo_light.png' }}
          />
          <button className="mobile-close-btn" onClick={() => setMenuAberto(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f5f5f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <ul className="nav-menu">
          <li>
            <a href="#" className="nav-item active">
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </span>
              Visão Geral
            </a>
          </li>
          <li>
            <a href="#" className="nav-item">
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              Transações
            </a>
          </li>
          <li>
            <a href="#" className="nav-item">
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </span>
              Relatórios
            </a>
          </li>
          <li>
            <a href="#" className="nav-item">
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              Configurações
            </a>
          </li>
        </ul>

        <div style={{ marginTop: 'auto' }}>
          <Link to="/login" className="nav-item">
            <span className="icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </span>
            Sair
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content relative z-10">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <div>
              <h1 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Olá, {usuario.nome} 👋
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Aqui está o resumo financeiro da sua conta.
              </p>
            </div>
          </div>
          
          <div className="user-profile">
            <div style={{ textAlign: 'right', display: 'none' }} className="sm:block">
              <div style={{ fontWeight: 500, fontSize: '14px' }}>{usuario.nome}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{usuario.email || 'usuário autenticado'}</div>
            </div>
            <div className="avatar">{usuario.nome.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card accent">
            <div className="kpi-header">
              <span>Saldo Total</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--accent)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <div className="kpi-value">R$ 0,00</div>
            <div className="trend-up" style={{ color: 'var(--text-secondary)' }}>Sem dados no período</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span>Receitas</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div className="kpi-value">R$ 0,00</div>
            <div className="trend-up" style={{ color: 'var(--text-secondary)' }}>Sem receitas cadastradas</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span>Despesas</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--danger)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
              </svg>
            </div>
            <div className="kpi-value">R$ 0,00</div>
            <div className="trend-down" style={{ color: 'var(--text-secondary)' }}>Sem despesas cadastradas</div>
          </div>
        </div>

        {/* Recent Transactions Table */}
        <section className="content-section">
          <div className="section-header">
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Transações Recentes</h2>
            <button className="btn-primary">+ Nova Transação</button>
          </div>

          <div style={{ overflowX: 'auto', textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <p>Nenhuma transação encontrada para este período.</p>
          </div>
        </section>
      </main>
    </div>
  )
}
