import { useSwipeReveal } from '../../hooks/useSwipeReveal'
import { IconCheck, IconEdit, IconX } from './ListaIcons'
import { formatarMoeda } from '../../lib/listaCompras'

// Linha de item da lista — extraída para evitar re-renders desnecessários.

export function ItemRow({ item, onToggle, onRemover, onEditar, mostrarMedida = true, onAjustarUnidades, mostrarAutor = false }) {
  const prazoFmt = item.prazo
    ? new Date(item.prazo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null
  const { ref: swipeRef, closeIfOpen } = useSwipeReveal({ reveal: 72 })
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
          <span className="page-lista-compras__item-prazo" title="Lembrete na agenda">📅 {prazoFmt}</span>
        )}
        {mostrarAutor && item.checked && item.checked_por_nome && (
          <span className="page-lista-compras__item-autor" title={`Marcado por ${item.checked_por_nome}`}>
            ✓ {item.checked_por_nome}
          </span>
        )}
        {mostrarMedida && (
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
        {item.preco_estimado != null && Number(item.preco_estimado) > 0 && (
          <span className="page-lista-compras__item-price">
            {formatarMoeda(Number(item.preco_estimado) * Math.max(1, Number(item.unidades) || 1))}
          </span>
        )}
      </div>
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
