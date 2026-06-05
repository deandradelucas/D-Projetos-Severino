import React from 'react'
import { createPortal } from 'react-dom'
import { formatCurrencyBRL } from '../../lib/formatCurrency'
import { TransacaoCategoriaIcon } from '../TransacaoCategoriaIcon'
import { transacaoDescricaoEfetiva } from '../../lib/transacaoUtils'
import { useSheetDragClose } from '../../hooks/useSheetDragClose'

/**
 * Modal/bottom-sheet de detalhes de uma transação.
 * Tap numa linha abre este modal com todas as informações legíveis + ações.
 */
export function TransacaoDetalheModal({ tx, onClose, onEdit, onDelete, privacyMode }) {
  const sheetRef = React.useRef(null)
  React.useEffect(() => {
    if (!tx) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tx, onClose])
  useSheetDragClose(sheetRef, { open: Boolean(tx), onClose })

  if (!tx) return null

  const isRec = tx.tipo === 'RECEITA'
  const catNome = (tx.categorias?.nome && String(tx.categorias.nome).trim()) || '—'
  const subNome =
    tx.subcategorias?.nome && String(tx.subcategorias.nome).trim()
      ? String(tx.subcategorias.nome).trim()
      : ''
  const valorAbs = Math.abs(parseFloat(tx.valor) || 0)
  const descricao = transacaoDescricaoEfetiva(tx)
  const isParcela = Boolean(tx.recorrente_index)
  const isRecorrente = !isParcela && Boolean(tx.recorrencia_mensal_id)
  const isPendente = tx.status === 'PENDENTE'

  const fmtDataHora = (v) => {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }
  const fmtDataDia = (v) => {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  // Em parceladas, data_transacao é o vencimento da parcela e data_compra é a data
  // original da compra. "Data e hora" mostra a compra; "Data Vencimento" mostra o vencimento.
  const temDataCompra = Boolean(tx.data_compra)
  const dataFmt = fmtDataHora(tx.data_compra || tx.data_transacao)
  const dataVencimentoFmt = fmtDataDia(tx.data_transacao)

  return createPortal(
    <div
      className="modal-backdrop tx-detalhe-overlay"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-content tx-detalhe-modal"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da transação"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tx-detalhe-modal__head">
          <span className={`tx-detalhe-modal__tipo ${isRec ? 'is-rec' : 'is-desp'}`}>
            {isRec ? 'Receita' : 'Despesa'}
          </span>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg></button>
        </div>

        <div className="tx-detalhe-modal__hero">
          <span className="tx-detalhe-modal__icon" aria-hidden>
            <TransacaoCategoriaIcon
              categoriaNome={catNome}
              subcategoriaNome={subNome || undefined}
              isReceita={isRec}
              size={26}
            />
          </span>
          <p className={`tx-detalhe-modal__valor ${isRec ? 'is-pos' : 'is-neg'} ${privacyMode ? 'privacy-blur' : ''}`}>
            {isRec ? '+' : '−'}{formatCurrencyBRL(valorAbs)}
          </p>
          <p className="tx-detalhe-modal__titulo">{descricao || catNome}</p>
          {isPendente ? <span className="tx-detalhe-modal__pendente">Pendente</span> : null}
        </div>

        <dl className="tx-detalhe-modal__list">
          {descricao ? (
            <div className="tx-detalhe-modal__row">
              <dt>Descrição</dt>
              <dd>{descricao}</dd>
            </div>
          ) : null}
          <div className="tx-detalhe-modal__row">
            <dt>Categoria</dt>
            <dd>{catNome}</dd>
          </div>
          {subNome ? (
            <div className="tx-detalhe-modal__row">
              <dt>Subcategoria</dt>
              <dd>{subNome}</dd>
            </div>
          ) : null}
          <div className="tx-detalhe-modal__row">
            <dt>{isParcela && temDataCompra ? 'Data da compra' : 'Data e hora'}</dt>
            <dd>{dataFmt}</dd>
          </div>
          {isParcela && temDataCompra ? (
            <div className="tx-detalhe-modal__row">
              <dt>Data de vencimento</dt>
              <dd>{dataVencimentoFmt}</dd>
            </div>
          ) : null}
          <div className="tx-detalhe-modal__row">
            <dt>Status</dt>
            <dd>
              <span className={`tx-detalhe-modal__status ${isPendente ? 'is-pend' : 'is-pago'}`}>
                {isPendente ? 'Pendente' : 'Pago'}
              </span>
            </dd>
          </div>
          {isParcela ? (
            <div className="tx-detalhe-modal__row">
              <dt>Parcela</dt>
              <dd>{tx.recorrente_index}/{tx.recorrente_total}</dd>
            </div>
          ) : null}
          {isRecorrente ? (
            <div className="tx-detalhe-modal__row">
              <dt>Recorrência</dt>
              <dd>Mensal (dia 1)</dd>
            </div>
          ) : null}
          {tx.lancado_por_nome ? (
            <div className="tx-detalhe-modal__row">
              <dt>Lançado por</dt>
              <dd className={privacyMode ? 'privacy-blur' : ''}>{tx.lancado_por_nome}</dd>
            </div>
          ) : null}
        </dl>

        <div className="tx-detalhe-modal__actions">
          <button type="button" className="btn-secondary" onClick={() => { onClose(); onEdit(tx) }}>
            Editar
          </button>
          <button type="button" className="tx-detalhe-modal__delete" onClick={() => { onClose(); onDelete(tx) }}>
            Excluir
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
