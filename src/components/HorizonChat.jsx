import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function getUsuarioId() {
  try {
    const saved = localStorage.getItem('horizonte_user')
    return saved ? JSON.parse(saved)?.id : null
  } catch {
    return null
  }
}

function MarkdownText({ text }) {
  // Render simple markdown: **bold**, *italic*, bullet lists, line breaks
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br/>')

  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export default function HorizonChat() {
  useTheme()
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState([
    {
      id: 1,
      role: 'model',
      text: 'Olá! Sou o **Horizon**, seu assistente financeiro pessoal. 👋\n\nPosso ajudar você a entender seus gastos, analisar seu saldo, identificar padrões e dar dicas financeiras. Como posso te ajudar hoje?',
      ts: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (aberto) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [aberto, mensagens.length])

  const enviarMensagem = async () => {
    const msg = input.trim()
    if (!msg || carregando) return

    const usuarioId = getUsuarioId()
    
    setMensagens(prev => [
      ...prev,
      { id: Date.now(), role: 'user', text: msg, ts: new Date() }
    ])
    setInput('')
    setErro(null)
    setCarregando(true)

    // Montar histórico (excluindo a mensagem welcome e mensagens de erro)
    const historico = mensagens
      .filter(m => m.id !== 1)
      .map(m => ({ role: m.role, text: m.text }))

    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(usuarioId ? { 'x-user-id': usuarioId } : {})
        },
        body: JSON.stringify({ message: msg, historico })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Erro desconhecido')
      }

      setMensagens(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'model', text: data.resposta, ts: new Date() }
      ])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensagem()
    }
  }

  return (
    <>
      {/* Botão Flutuante */}
      <button
        id="horizon-chat-btn"
        className={`horizon-chat-fab ${aberto ? 'chat-fab-active' : ''}`}
        onClick={() => setAberto(v => !v)}
        title="Pergunte ao Horizon"
        aria-label="Abrir assistente Horizon"
      >
        {aberto ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-5.06-1.37L2 22l1.4-4.94A9.96 9.96 0 0 1 2 12 10 10 0 0 1 12 2z"/>
            <path d="M8 10h.01M12 10h.01M16 10h.01"/>
          </svg>
        )}
        {!aberto && (
          <span className="horizon-fab-pulse" />
        )}
      </button>

      {/* Janela de Chat */}
      <div
        id="horizon-chat-window"
        className={`horizon-chat-window ${aberto ? 'chat-window-open' : ''}`}
        aria-hidden={!aberto}
      >
        {/* Header */}
        <div className="horizon-chat-header">
          <div className="horizon-chat-header-info">
            <div className="horizon-avatar-dot">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
              </svg>
            </div>
            <div>
              <div className="horizon-chat-name">Pergunte ao Horizon</div>
              <div className="horizon-chat-status">
                <span className="horizon-status-dot" />
                IA Financeira · Gemini
              </div>
            </div>
          </div>
          <button
            className="horizon-chat-close"
            onClick={() => setAberto(false)}
            aria-label="Fechar chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="horizon-chat-messages" id="horizon-messages">
          {mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`horizon-msg ${msg.role === 'user' ? 'horizon-msg-user' : 'horizon-msg-model'}`}
            >
              {msg.role === 'model' && (
                <div className="horizon-msg-avatar">H</div>
              )}
              <div className="horizon-msg-bubble">
                <MarkdownText text={msg.text} />
                <div className="horizon-msg-time">
                  {msg.ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {/* Digitando */}
          {carregando && (
            <div className="horizon-msg horizon-msg-model">
              <div className="horizon-msg-avatar">H</div>
              <div className="horizon-msg-bubble horizon-typing">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && !carregando && (
            <div className="horizon-error-msg">
              ⚠️ {erro}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="horizon-chat-input-area">
          <textarea
            ref={inputRef}
            className="horizon-chat-input"
            placeholder="Pergunte sobre suas finanças..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={carregando}
            id="horizon-chat-input"
            aria-label="Mensagem para o Horizon"
          />
          <button
            className={`horizon-send-btn ${carregando || !input.trim() ? 'horizon-send-disabled' : ''}`}
            onClick={enviarMensagem}
            disabled={carregando || !input.trim()}
            aria-label="Enviar mensagem"
          >
            {carregando ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
              </svg>
            )}
          </button>
        </div>

        {/* Sugestões Rápidas */}
        {mensagens.length <= 2 && !carregando && (
          <div className="horizon-suggestions">
            {[
              'Qual é meu saldo atual?',
              'Onde estou gastando mais?',
              'Como posso economizar?',
            ].map(s => (
              <button
                key={s}
                className="horizon-suggestion-chip"
                onClick={() => {
                  setInput(s)
                  setTimeout(() => inputRef.current?.focus(), 50)
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
