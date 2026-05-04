import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import { parseApiJsonResponse } from '../lib/apiErrors'
import { BRAND_ASSETS } from '../lib/brandAssets'
/* Estilos do FAB/janela (.horizon-*). Deve carregar no bundle principal: antes do lazy Dashboard,
   AppSessionOutlet pode bloquear a rota e o import em Dashboard.jsx não roda — chat ficava sem CSS. */
import '../pages/dashboard.css'

/** Ancora FAB + janela ao `main.main-content` do app shell (canto inferior direito “dentro” do painel). */
function useHorizonShellDock() {
  const location = useLocation()
  const [dock, setDock] = useState(null)

  useLayoutEffect(() => {
    const excluded = ['/login', '/cadastro', '/'].includes(location.pathname)
    if (excluded) {
      queueMicrotask(() => setDock(null))
      return
    }

    let raf = 0
    let ro = null
    let attempts = 0
    let retryTimer = 0

    const run = () => {
      const main = document.querySelector('.dashboard-container.app-horizon-shell main.main-content')
      if (!main) {
        setDock(null)
        if (attempts < 16) {
          attempts += 1
          retryTimer = window.setTimeout(schedule, 160)
        }
        return
      }
      attempts = 0
      window.clearTimeout(retryTimer)
      const r = main.getBoundingClientRect()
      const mobile = window.matchMedia('(max-width: 768px)').matches
      const fabSize = mobile ? 52 : 56
      const insetH = mobile ? 10 : 8
      /* “Sobe” o FAB: maior offset = mais alto na tela; pode sobrepor o card */
      const lift = mobile ? 14 : 40
      const gap = 8

      const fabBottom = Math.max(insetH, window.innerHeight - r.bottom + lift)
      const fabRight = Math.max(insetH, window.innerWidth - r.right + insetH)

      if (mobile) {
        /* Cartão compacto, centralizado no painel — não ocupa a largura inteira */
        const sideInset = 10
        const mainL = r.left
        const mainR = r.right
        const mainW = Math.max(0, mainR - mainL)
        const maxCardW = 384
        const w = Math.min(maxCardW, Math.max(260, mainW - sideInset * 2))
        const left = mainL + (mainW - w) / 2
        setDock({
          fabStyle: { position: 'fixed', bottom: fabBottom, right: fabRight },
          winStyle: {
            position: 'fixed',
            left: `${left}px`,
            width: `${w}px`,
            right: 'auto',
            bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
            maxWidth: `${w}px`,
            maxHeight: 'min(64dvh, 500px)',
            height: 'min(64dvh, 500px)',
          },
        })
        return
      }

      const winBottom = fabBottom + fabSize + gap
      const maxW = Math.min(352, Math.max(260, r.width - insetH * 2))
      const winH = Math.min(520, Math.max(280, window.innerHeight - winBottom - 24))
      setDock({
        fabStyle: { position: 'fixed', bottom: fabBottom, right: fabRight },
        winStyle: {
          position: 'fixed',
          bottom: winBottom,
          right: fabRight,
          left: 'auto',
          width: `${maxW}px`,
          maxWidth: `${maxW}px`,
          height: `${winH}px`,
          maxHeight: `${winH}px`,
        },
      })
    }

    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(run)
    }

    const connectRo = () => {
      const mainEl = document.querySelector('.dashboard-container.app-horizon-shell main.main-content')
      if (!mainEl || ro) return
      ro = new ResizeObserver(schedule)
      ro.observe(mainEl)
    }

    schedule()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        schedule()
        connectRo()
      })
    })
    const fallback = window.setTimeout(() => {
      schedule()
      connectRo()
    }, 160)

    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)

    return () => {
      window.clearTimeout(fallback)
      window.clearTimeout(retryTimer)
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [location.pathname])

  return dock
}

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
  const location = useLocation()
  const shellDock = useHorizonShellDock()
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

    if (!usuarioId) {
      setErro('Faça login novamente para o Horizon acessar seus dados.')
      setCarregando(false)
      return
    }

    // Montar histórico (excluindo a mensagem welcome e mensagens de erro)
    const historico = mensagens
      .filter(m => m.id !== 1)
      .map(m => ({ role: m.role, text: m.text }))

    try {
      const res = await fetch(apiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(usuarioId ? { 'x-user-id': String(usuarioId) } : {})
        },
        body: JSON.stringify({ message: msg, historico })
      })

      const parsed = await parseApiJsonResponse(res)
      if (!parsed.ok) {
        throw new Error(parsed.userMessage || 'Erro ao enviar mensagem.')
      }

      const resposta = parsed.data?.resposta
      if (typeof resposta !== 'string' || !resposta.trim()) {
        throw new Error('Resposta vazia do assistente.')
      }

      setMensagens(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'model', text: resposta, ts: new Date() }
      ])
    } catch (err) {
      const msg =
        err instanceof TypeError && String(err.message).includes('fetch')
          ? 'Sem conexão com o servidor. Confirme que o app está no ar e tente de novo.'
          : err.message || 'Erro ao enviar mensagem.'
      setErro(msg)
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

  if (['/login', '/cadastro', '/'].includes(location.pathname)) {
    return null
  }

  return (

    <>
      {/* Botão Flutuante */}
      <button
        id="horizon-chat-btn"
        type="button"
        className={`horizon-chat-fab ${aberto ? 'chat-fab-active' : ''} ${shellDock ? 'horizon-chat-fab--shell-dock' : ''}`}
        style={shellDock?.fabStyle}
        onClick={() => setAberto(v => !v)}
        title="Horizon IA"
        aria-label="Abrir Horizon IA"
      >
        {aberto ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        ) : (
          <img
            src={BRAND_ASSETS.appIcon}
            alt=""
            className="horizon-fab-logo"
            width={32}
            height={32}
            decoding="async"
            aria-hidden
          />
        )}
        {!aberto && (
          <span className="horizon-fab-pulse" />
        )}
      </button>

      {/* Janela de Chat */}
      <div
        id="horizon-chat-window"
        className={`horizon-chat-window ${aberto ? 'chat-window-open' : ''} ${shellDock ? 'horizon-chat-window--shell-dock' : ''}`}
        style={shellDock?.winStyle}
        aria-hidden={!aberto}
      >
        {/* Header */}
        <div className="horizon-chat-header">
          <div className="horizon-chat-header-info">
            <div className="horizon-avatar-dot horizon-avatar-dot--pwa">
              <img src={BRAND_ASSETS.appIcon} alt="" width={28} height={28} decoding="async" />
            </div>
            <div>
              <div className="horizon-chat-name">Horizon IA</div>
              <div className="horizon-chat-status">
                <span className="horizon-status-dot" />
                Finanças e agenda · Gemini
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
                <div className="horizon-msg-avatar" aria-hidden>
                  <img src={BRAND_ASSETS.appIcon} alt="" className="horizon-msg-avatar__img" width={24} height={24} decoding="async" />
                </div>
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
              <div className="horizon-msg-avatar" aria-hidden>
                <img src={BRAND_ASSETS.appIcon} alt="" className="horizon-msg-avatar__img" width={24} height={24} decoding="async" />
              </div>
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

        {/* Sugestões rápidas (acima do campo, padrão chat) */}
        {mensagens.length <= 2 && !carregando && (
          <div className="horizon-suggestions">
            {[
              'Qual é meu saldo atual?',
              'Onde estou gastando mais?',
              'Como posso economizar?',
            ].map(s => (
              <button
                key={s}
                type="button"
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

        {/* Campo de mensagem */}
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
            type="button"
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
      </div>
    </>
  )
}
