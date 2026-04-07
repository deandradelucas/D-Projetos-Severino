import React, { useState } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import { useTheme } from '../context/ThemeContext'

export default function Configuracoes() {
  const { theme, toggleTheme, privacyMode, togglePrivacy } = useTheme()
  const [menuAberto, setMenuAberto] = useState(false)
  
  const [usuario] = useState(() => {
    const saved = localStorage.getItem('horizonte_user')
    return saved ? JSON.parse(saved) : { id: null, nome: 'Usuário', email: 'usuario@exemplo.com' }
  })
  
  const [telefone, setTelefone] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  React.useEffect(() => {
    if (usuario?.id) {
      fetch('/api/usuarios/perfil', {
        headers: { 'x-user-id': usuario.id }
      })
      .then(res => res.json())
      .then(data => {
        if (data.perfil?.telefone) {
          setTelefone(data.perfil.telefone)
        }
      })
      .catch(err => console.error(err))
    }
  }, [usuario?.id])

  const handleSaveTelefone = async () => {
    if (!telefone) return
    setIsSaving(true)
    setSaveMessage('')
    try {
      const res = await fetch('/api/usuarios/telefone', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': usuario.id
        },
        body: JSON.stringify({ telefone })
      })
      const data = await res.json()
      if (res.ok) {
        setSaveMessage('Número salvo com sucesso!')
        setTelefone(data.telefone || telefone)
      } else {
        setSaveMessage(data.message || 'Erro ao salvar.')
      }
    } catch (err) {
      setSaveMessage('Erro de conexão ao salvar.')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(''), 4000)
    }
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="14" rx="1"/>
                <rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>Configurações</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Personalize sua experiência no Horizonte</p>
            </div>
          </div>
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

          {/* WhatsApp Integração Section */}
          <section className="content-section">
            <div className="section-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Integração WhatsApp
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Cadastre o seu número de WhatsApp para poder adicionar despesas e receitas automaticamente enviando uma mensagem.
              </p>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Meu número (com DDD)</label>
                <input 
                  type="text" 
                  placeholder="Ex: 5547999999999" 
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    marginBottom: '12px'
                  }}
                />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    className="btn-primary" 
                    onClick={handleSaveTelefone}
                    disabled={isSaving}
                    style={{ flex: 1, padding: '12px', background: '#25D366', color: '#fff', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)', border: 'none' }}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Número'}
                  </button>
                  {saveMessage && (
                    <span style={{ fontSize: '13px', fontWeight: 500, color: saveMessage.includes('sucesso') ? 'var(--success)' : 'var(--danger)' }}>
                      {saveMessage}
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: 'rgba(37, 211, 102, 0.1)', 
                borderRadius: '12px',
                border: '1px solid rgba(37, 211, 102, 0.2)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', marginBottom: '4px' }}>Como usar?</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Mande para o nosso bot uma mensagem como: <br/><strong style={{color:'var(--text-primary)'}}>"gastei 50 com ifood"</strong> ou <strong style={{color:'var(--text-primary)'}}>"recebi 500 do freela"</strong>. A IA fará o resto!</div>
              </div>
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
