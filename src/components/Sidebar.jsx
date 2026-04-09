import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { isSuperAdminSession } from '../lib/superAdmin'

/** Ordem vertical no menu (índice sobe/desce a bolinha) */
const MENU_ORDER = [
  '/dashboard',
  '/transacoes',
  '/relatorios',
  '/pagamento',
  '/configuracoes',
  '/admin/whatsapp',
  '/admin/usuarios',
  '/admin/pagamentos',
]

export default function Sidebar({ menuAberto, setMenuAberto }) {
  const location = useLocation()
  const prevMenuIdx = useRef(-1)
  const [dotMotion, setDotMotion] = useState(null)
  const [principalAdmin, setPrincipalAdmin] = useState(() => isSuperAdminSession())
  const [pagamentoSub, setPagamentoSub] = useState('')
  const [assinaturaBadge, setAssinaturaBadge] = useState('')
  const [assinaturaManageUrl, setAssinaturaManageUrl] = useState('')

  const situacaoLabel = (code) => {
    const m = {
      admin: 'Administrador',
      isento: 'Isento',
      trial: 'Período de teste',
      ativo: 'Assinatura ativa',
      pausada: 'Assinatura pausada (MP)',
      cancelada: 'Assinatura cancelada (MP)',
      inativa: 'Sem assinatura ativa',
    }
    return m[code] || ''
  }

  const refreshPagamentoSub = () => {
    try {
      const raw = localStorage.getItem('horizonte_user')
      const u = raw ? JSON.parse(raw) : null
      const situacao = u?.assinatura_situacao
      setAssinaturaBadge(situacao ? situacaoLabel(String(situacao)) : '')
      setAssinaturaManageUrl(typeof u?.mp_gerenciar_url === 'string' ? u.mp_gerenciar_url.trim() : '')

      const d = u?.assinatura_proxima_cobranca
      if (!d) {
        setPagamentoSub('')
        return
      }
      const dt = new Date(d)
      if (Number.isNaN(dt.getTime())) {
        setPagamentoSub('')
        return
      }
      setPagamentoSub(`Próx. cobrança ${dt.toLocaleDateString('pt-BR')}`)
    } catch {
      setPagamentoSub('')
      setAssinaturaBadge('')
      setAssinaturaManageUrl('')
    }
  }

  useEffect(() => {
    setPrincipalAdmin(isSuperAdminSession())
  }, [location.pathname])

  useEffect(() => {
    refreshPagamentoSub()
  }, [location.pathname])

  useEffect(() => {
    const h = () => refreshPagamentoSub()
    window.addEventListener('horizonte-session-refresh', h)
    return () => window.removeEventListener('horizonte-session-refresh', h)
  }, [])

  useEffect(() => {
    const idx = MENU_ORDER.indexOf(location.pathname)
    if (idx < 0) return

    if (prevMenuIdx.current >= 0 && prevMenuIdx.current !== idx) {
      const timeouts = []
      timeouts.push(
        window.setTimeout(() => setDotMotion(idx > prevMenuIdx.current ? 'down' : 'up'), 0)
      )
      timeouts.push(window.setTimeout(() => setDotMotion(null), 680))
      prevMenuIdx.current = idx
      return () => timeouts.forEach((id) => window.clearTimeout(id))
    }
    prevMenuIdx.current = idx
  }, [location.pathname])

  // Sidebar agora é sempre Full Black, logo sempre usa a versão clara (branca)
  const logoSrc = '/images/horizonte_fiel_original_logo_dark.png'
  return (
    <>
      {/* Mobile Backdrop */}
      {menuAberto && (
        <div className="mobile-backdrop" onClick={() => setMenuAberto(false)} />
      )}

      <aside className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="brand-wrapper">
          <img 
            src={logoSrc} 
            alt="Horizonte Financeiro" 
            className="brand-logo" 
          />
          <button
            type="button"
            className="mobile-close-btn"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {(assinaturaBadge || assinaturaManageUrl || pagamentoSub) && (
          <div className="sidebar-assinatura" aria-live="polite">
            {assinaturaBadge ? (
              <div className="sidebar-assinatura__badge" title="Status da sua assinatura">
                {assinaturaBadge}
              </div>
            ) : null}
            {pagamentoSub ? <div className="sidebar-assinatura__line">{pagamentoSub}</div> : null}
            {assinaturaManageUrl ? (
              <a
                className="sidebar-assinatura__link"
                href={assinaturaManageUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abre o Mercado Pago para gerenciar débitos e assinatura"
              >
                Gerenciar no Mercado Pago
              </a>
            ) : null}
          </div>
        )}

        <ul
          className="nav-menu"
          data-dot-motion={dotMotion || undefined}
        >
          <li>
            <NavLink 
              to="/dashboard" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
              onClick={() => setMenuAberto(false)}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="7" height="7" x="3" y="3" rx="1"/>
                  <rect width="7" height="7" x="14" y="3" rx="1"/>
                  <rect width="7" height="7" x="14" y="14" rx="1"/>
                  <rect width="7" height="7" x="3" y="14" rx="1"/>
                </svg>
              </span>
              Visão Geral
            </NavLink>
          </li>
          <li>
            <NavLink 
              to="/transacoes" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} 
              onClick={() => setMenuAberto(false)}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                  <path d="M12 18V6"/>
                </svg>
              </span>
              Transações
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/relatorios"
              end
              title="Gráficos, resumo do período e exportação CSV ou PDF"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMenuAberto(false)}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </span>
              Relatórios
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/pagamento"
              title={
                [assinaturaBadge, pagamentoSub].filter(Boolean).join(' — ') ||
                'Assinatura mensal Mercado Pago'
              }
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMenuAberto(false)}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </span>
              <span className="nav-item__label">
                <span className="nav-item__title">Pagamento</span>
                {pagamentoSub ? <span className="nav-item__sub">{pagamentoSub}</span> : null}
              </span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/configuracoes"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMenuAberto(false)}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
              Configurações
            </NavLink>
          </li>

          {principalAdmin && (
            <>
              <li className="nav-section-label">
                <span className="nav-section-label__text">Administração</span>
              </li>
              <li>
                <NavLink
                  to="/admin/whatsapp"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMenuAberto(false)}
                >
                  <span className="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </span>
                  Logs do WhatsApp
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin/usuarios"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMenuAberto(false)}
                >
                  <span className="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </span>
                  Logs Usuários
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin/pagamentos"
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMenuAberto(false)}
                >
                  <span className="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" x2="22" y1="10" y2="10" />
                    </svg>
                  </span>
                  Logs de Pagamentos
                </NavLink>
              </li>
            </>
          )}
        </ul>

        {/* Botão Sair — empurrado para o rodapé */}
        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem('horizonte_user')
            window.location.href = '/'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          Sair
        </button>
      </aside>
    </>
  )
}
