import { useSwipeReveal } from '../../hooks/useSwipeReveal'
import { IconCheck, IconEdit, IconX } from './ListaIcons'
import { formatarMoeda } from '../../lib/listaCompras'

// Linha de item da lista — extraída para evitar re-renders desnecessários.

export function ItemRow({ item, onToggle, onRemover, onEditar, mostrarMedida = true, onAjustarUnidades, mostrarAutor = false }) {
  const prazoFmt = item.prazo
    ? new Date(item.prazo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null
  const { ref: swipeRef, closeIfOpen } = useSwipeReveal({ reveal: 72 })
  // Medida só faz sentido quando é uma unidade real (kg, g, L…). Quando é "un"
  // genérico, o stepper de unidades já comunica a contagem — esconde p/ não duplicar.
  const medidaReal = item.unidade && item.unidade !== 'un'
  return (
    <div
      ref={swipeRef}
      onClickCapture={closeIfOpen}
      className={`page-lista-compras__item${item.checked ? ' page-lista-compras__item--checked' : ''}`}
    >
      <div className="page-lista-compras__item-fg">
      <button
        type="button"
        className={`page-lista-compras__item-check${item.checked ? ' page-lista-compras__item-check--checked' : ''}`}
        onClick={() => onToggle(item)}
        aria-label={item.checked ? `Desmarcar ${item.nome}` : `Marcar ${item.nome} como comprado`}
        aria-pressed={item.checked}
      >
        {item.checked && <IconCheck />}
      </button>

      <div className="page-lista-compras__item-body">
        <span className="page-lista-compras__item-name">{item.nome}</span>
        {prazoFmt && (
          <span className="page-lista-compras__item-prazo" title="Lembrete na agenda">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" />
            </svg>
            {prazoFmt}
          </span>
        )}
        {mostrarAutor && item.checked && item.checked_por_nome && (
          <span className="page-lista-compras__item-autor" title={`Marcado por ${item.checked_por_nome}`}>
            <IconCheck /> {item.checked_por_nome}
          </span>
        )}
        {mostrarMedida && medidaReal && (
        <span className="page-lista-compras__item-qty">{Number(item.quantidade)} {item.unidade}</span>
        )}
        {mostrarMedida && onAjustarUnidades && (
        <span className="page-lista-compras__item-stepper">
          <button
            type="button"
            className="page-lista-compras__item-step"
            onClick={() => onAjustarUnidades(item, -1)}
            disabled={(Number(item.unidades) || 1) <= 1}
            aria-label="Diminuir unidades"
          >−</button>
          <span className="page-lista-compras__item-units">{Math.max(1, Number(item.unidades) || 1)}un</span>
          <button
            type="button"
            className="page-lista-compras__item-step"
            onClick={() => onAjustarUnidades(item, 1)}
            aria-label="Aumentar unidades"
          >+</button>
        </span>
        )}
        {mostrarMedida && !onAjustarUnidades && (
        <span className="page-lista-compras__item-units">
          {Math.max(1, Number(item.unidades) || 1)}un
        </span>
        )}
        {mostrarMedida && (
          <span className="page-lista-compras__item-price">
            {formatarMoeda((Number(item.preco_estimado) || 0) * Math.max(1, Number(item.unidades) || 1))}
          </span>
        )}
      </div>
      <span className="page-lista-compras__item-swipe-hint" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </span>
      </div>

      <div className="page-lista-compras__item-actions">
        {onEditar && (
          <button
            type="button"
            className="page-lista-compras__item-edit"
            onClick={() => onEditar(item)}
            aria-label={`Editar ${item.nome}`}
          >
            <IconEdit />
          </button>
        )}
        <button
          type="button"
          className="page-lista-compras__item-delete"
          onClick={() => onRemover(item.id)}
          aria-label={`Remover ${item.nome}`}
        >
          <IconX />
        </button>
      </div>
    </div>
  )
}
