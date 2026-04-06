import React, { useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import { useTheme } from '../context/ThemeContext'

export default function Configuracoes() {
  const { theme, toggleTheme, privacyMode, togglePrivacy } = useTheme()
  const [menuAberto, setMenuAberto] = useState(false)
  
  const [usuario] = useState(() => {
    const saved = localStorage.getItem('horizonte_user')
    return saved ? JSON.parse(saved) : { nome: 'Usuário', email: 'usuario@exemplo.com' }
  })

  const themes = [
    { id: 'light', name: 'Claro', icon: '☀️', desc: 'Visual limpo e profissional' },
    { id: 'dark', name: 'Escuro', icon: '🌙', desc: 'Conforto visual para a noite' },
    { id: 'glass', name: 'Vitrificado', icon: '✨', desc: 'Design premium e translúcido' }
  ]

  return (
    <div className="dashboard-container">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />
      
      <main className="main-content">
        <header className="top-header">
          <div>
            <h1>Configurações</h1>
            <p>Personalize sua experiência no Horizonte</p>
          </div>
          
          <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          
          {/* Perfil Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Seu Perfil</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '10px 0' }}>
              <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '24px' }}>
                {usuario.nome.charAt(0)}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '18px' }}>{usuario.nome}</h4>
                <p style={{ margin: '4px 0 0 0', opacity: 0.6 }}>{usuario.email}</p>
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: '24px', width: '100%', background: 'rgba(0,0,0,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
              Editar Perfil
            </button>
          </section>

          {/* Preferências Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Preferências</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Modo Privacidade</div>
                  <div style={{ fontSize: '12px', opacity: 0.6 }}>Ocultar valores na tela principal</div>
                </div>
                <input 
                  type="checkbox" 
                  className="switch-apple" 
                  checked={privacyMode}
                  onChange={togglePrivacy}
                  style={{ width: '40px', height: '20px' }}
                />
              </label>
              
              <div style={{ height: '1px', background: 'var(--border-color)' }} />
              
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.5 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Notificações por E-mail</div>
                  <div style={{ fontSize: '12px', opacity: 0.6 }}>Resumos semanais de gastos</div>
                </div>
                <input type="checkbox" checked readOnly style={{ width: '40px', height: '20px' }} />
              </label>
            </div>
          </section>

          {/* Temas Section */}
          <section className="content-section" style={{ gridColumn: '1 / -1' }}>
            <div className="section-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Aparência do Sistema</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              {themes.map(t => (
                <div 
                  key={t.id}
                  onClick={() => toggleTheme(t.id)}
                  style={{ 
                    padding: '24px', 
                    borderRadius: '20px', 
                    border: `2px solid ${theme === t.id ? 'var(--accent)' : 'var(--border-color)'}`,
                    background: theme === t.id ? 'rgba(212, 168, 75, 0.05)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>{t.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', opacity: 0.6 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
