import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconX, IconCheck } from './ListaIcons'
import { formatarMoeda } from '../../lib/listaCompras'

// Modo Comprando — tela fullscreen para o mercado. Extraído de pages/ListaDeCompras.jsx.

export function ModoComprando({ lista, itens, onToggle, onClose }) {
  const pendentes = itens.filter((i) => !i.checked)
  const noCarrinho = itens.filter((i) => i.checked)
  const totalCarrinho = noCarrinho.reduce((s, i) => {
    const p = i.preco_estimado != null ? Number(i.preco_estimado) : 0
    return s + p * Math.max(1, Number(i.unidades) || 1)
  }, 0)
  const total = itens.length
  const feitos = noCarrinho.length

  // Mantém a tela acordada durante as compras (best-effort, sem suporte = ignora)
  useEffect(() => {
    let lock = null
    let released = false
    const pedir = async () => {
      try {
        if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen')
      } catch { /* sem suporte/negado */ }
    }
    void pedir()
    const onVis = () => {
      if (document.visibilityState === 'visible' && !released) void pedir()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVis)
      try { lock?.release?.() } catch { /* ignore */ }
    }
  }, [])

  // Trava o scroll do conteúdo por trás
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const precoItem = (item) =>
    item.preco_estimado != null && Number(item.preco_estimado) > 0
      ? formatarMoeda(Number(item.preco_estimado) * Math.max(1, Number(item.unidades) || 1))
      : ''

  return createPortal(
    <div className="modo-comprando" role="dialog" aria-modal="true" aria-label="Modo comprando">
      <header className="modo-comprando__header">
        <div className="modo-comprando__header-info">
          <span className="modo-comprando__lista-nome">{lista?.nome || 'Compras'}</span>
          <span className="modo-comprando__progresso">{feitos} de {total} no carrinho</span>
        </div>
        <button type="button" className="modo-comprando__close" onClick={onClose} aria-label="Sair do modo comprando">
          <IconX />
        </button>
      </header>

      <div className="modo-comprando__progress-bar" aria-hidden="true">
        <span
          className="modo-comprando__progress-fill"
          style={{ width: `${total > 0 ? (feitos / total) * 100 : 0}%` }}
        />
      </div>

      <div className="modo-comprando__scroll">
        {pendentes.length === 0 && (
          <div className="modo-comprando__done">
            <span className="modo-comprando__done-emoji" aria-hidden="true">🎉</span>
            <p className="modo-comprando__done-text">Tudo no carrinho!</p>
          </div>
        )}

        {pendentes.map((item) => (
          <button
            key={item.id}
            type="button"
            className="modo-comprando__item"
            onClick={() => onToggle(item)}
          >
            <span className="modo-comprando__check" aria-hidden="true" />
            <span className="modo-comprando__item-nome">{item.nome}</span>
            <span className="modo-comprando__item-meta">{precoItem(item)}</span>
          </button>
        ))}

        {noCarrinho.length > 0 && (
          <div className="modo-comprando__cart-section">
            <p className="modo-comprando__cart-label">No carrinho ({noCarrinho.length})</p>
            {noCarrinho.map((item) => (
              <button
                key={item.id}
                type="button"
                className="modo-comprando__item modo-comprando__item--done"
                onClick={() => onToggle(item)}
              >
                <span className="modo-comprando__check modo-comprando__check--on" aria-hidden="true">
                  <IconCheck />
                </span>
                <span className="modo-comprando__item-nome">{item.nome}</span>
                <span className="modo-comprando__item-meta">{precoItem(item)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="modo-comprando__footer">
        <div className="modo-comprando__total">
          <span className="modo-comprando__total-label">🛒 No carrinho</span>
          <span className="modo-comprando__total-value">{formatarMoeda(totalCarrinho)}</span>
        </div>
        <button type="button" className="modo-comprando__finish" onClick={onClose}>
          {pendentes.length === 0 ? 'Concluir' : 'Sair'}
        </button>
      </footer>
    </div>,
    document.body,
  )
}
