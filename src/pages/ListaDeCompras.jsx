import { useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'

/**
 * Lista de Compras — placeholder.
 *
 * A rota e o item no menu lateral já estão ativos; a UI completa (criar lista,
 * marcar item, partilhar com a família, integração com WhatsApp) ainda está
 * por construir. Mantendo o shell visual consistente com Agenda/Transações
 * para que o utilizador veja o cabeçalho e o menu corretamente enquanto a
 * funcionalidade é desenvolvida.
 */
export default function ListaDeCompras() {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="dashboard-container dashboard-page page-lista-compras ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
              <section className="dashboard-hub__hero" aria-label="Lista de Compras">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="dashboard-hub__hero-text">
                    <h1 className="dashboard-hub__title">Lista de Compras</h1>
                    <div className="dashboard-hub__balance-line" aria-live="polite">
                      <span>Em desenvolvimento</span>
                    </div>
                  </div>
                </div>
              </section>

              <section
                aria-label="Lista de Compras — em breve"
                style={{
                  marginTop: 16,
                  padding: '32px 24px',
                  borderRadius: 18,
                  background: 'var(--card-bg, rgba(255, 255, 255, 0.6))',
                  border: '1px solid var(--card-border, rgba(148, 163, 184, 0.22))',
                  textAlign: 'center',
                }}
              >
                <h2 style={{ marginTop: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                  Em breve por aqui.
                </h2>
                <p style={{ marginBottom: 0, opacity: 0.78, lineHeight: 1.5 }}>
                  Esta tela vai organizar tuas listas de compras — adicionar itens,
                  marcar como comprado, partilhar com a família e (quando fizer sentido)
                  registar o gasto direto em Transações.
                </p>
              </section>
            </RefDashboardScroll>
          </div>
        </main>
      </div>
    </div>
  )
}
