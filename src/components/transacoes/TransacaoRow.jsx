import React from 'react'
import RecorrenciaArrowIcon from '../RecorrenciaArrowIcon'
import { TransacaoCategoriaIcon } from '../TransacaoCategoriaIcon'
import { getCategoriaIconChipStyle } from '../../lib/categoriaIconStyle'
import { formatCurrencyBRL } from '../../lib/formatCurrency'
import { formatTransacaoListDateTime } from '../../lib/transacaoDateDisplay'
import { transacaoDescricaoEfetiva } from '../../lib/transacaoUtils'

const ParcelamentoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 15h4M14 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

/**
 * Renderiza uma linha individual da lista de transações.
 *
 * Props:
 *   t               — objeto transação
 *   mostrarQuemLancou — boolean
 *   privacyMode     — boolean
 *   onEdit          — fn(transacao)
 *   onDelete        — fn(transacao)
 */
export function TransacaoRow({
  t,
  mostrarQuemLancou,
  privacyMode,
  onEdit,
  onDelete,
  onOpenDetail,
  selected = false,
  onToggleSelect,
  selectionMode = false,
}) {
  const isRec = t.tipo === 'RECEITA'
  // Em parcelas, a linha exibe a data da COMPRA (data_compra); o agrupamento por dia
  // continua pelo vencimento (data_transacao), preservando o fluxo de caixa mensal.
  const dataExibirLinha = t.recorrente_index && t.data_compra ? t.data_compra : t.data_transacao
  const { line: dateLine, dateTimeAttr } = formatTransacaoListDateTime(dataExibirLinha)
  const catNome = (t.categorias?.nome && String(t.categorias.nome).trim()) || '—'
  const subRaw = t.subcategorias
  const subNome =
    subRaw && typeof subRaw === 'object' && subRaw.nome && String(subRaw.nome).trim()
      ? String(subRaw.nome).trim()
      : ''
  const valorAbs = Math.abs(parseFloat(t.valor) || 0)
  const isParcela = Boolean(t.recorrente_index)
  const isRecorrente = !isParcela && Boolean(t.recorrencia_mensal_id)
  const mostraIconeRecorrente = isParcela || isRecorrente
  const isPendente = t.status === 'PENDENTE'
  const descricaoExibir = transacaoDescricaoEfetiva(t)

  // Hierarquia: se tem descrição, ela é o título e categoria vira meta.
  // Sem descrição, categoria é o título.
  const titulo = descricaoExibir || catNome
  const showCatNoMeta = Boolean(descricaoExibir)

  // Swipe-to-reveal (mobile): desliza a linha p/ esquerda revelando Editar/Excluir.
  // Dirigido por --tx-swipe; só o CSS mobile (partial 26) consome a variável.
  const rowRef = React.useRef(null)
  const posRef = React.useRef(0)
  const REVEAL = 84
  React.useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const s = { startX: 0, startY: 0, axis: null, active: false, opened: false }
    const apply = (x, animate) => {
      el.style.setProperty('--tx-swipe', `${x}px`)
      el.classList.toggle('ref-tx-row--swiping', !animate)
      el.classList.toggle('ref-tx-row--revealed', x <= -REVEAL / 2)
      posRef.current = x
    }
    const start = (e) => {
      if (selectionMode || e.touches.length !== 1) return
      s.startX = e.touches[0].clientX
      s.startY = e.touches[0].clientY
      s.axis = null
      s.active = true
      s.opened = posRef.current <= -REVEAL / 2
    }
    const move = (e) => {
      if (!s.active) return
      const dx = e.touches[0].clientX - s.startX
      const dy = e.touches[0].clientY - s.startY
      if (!s.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (s.axis === 'y') { s.active = false; return }
      }
      if (e.cancelable) e.preventDefault()
      const base = s.opened ? -REVEAL : 0
      apply(Math.max(-REVEAL, Math.min(0, base + dx)), false)
    }
    const end = () => {
      if (!s.active) return
      s.active = false
      if (s.axis === 'x') apply(posRef.current < -REVEAL / 2 ? -REVEAL : 0, true)
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end, { passive: true })
    el.addEventListener('touchcancel', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [selectionMode])

  // Tap fora dos botões fecha a linha aberta (sem disparar o clique)
  const handleClickCapture = (e) => {
    if (posRef.current <= -REVEAL / 2 && !e.target.closest('.ref-tx-actions-cell')) {
      e.preventDefault()
      e.stopPropagation()
      const el = rowRef.current
      if (el) {
        el.style.setProperty('--tx-swipe', '0px')
        el.classList.remove('ref-tx-row--swiping', 'ref-tx-row--revealed')
        posRef.current = 0
      }
    }
  }

  // Tap na linha (fora de ações/checkbox, sem swipe aberto, fora de seleção) → abre detalhes
  const handleRowClick = (e) => {
    if (!onOpenDetail || selectionMode) return
    if (posRef.current <= -REVEAL / 2) return
    if (e.target.closest('.ref-tx-actions-cell') || e.target.closest('.ref-tx-select')) return
    onOpenDetail(t)
  }

  return (
    <div
      key={t.id}
      ref={rowRef}
      role="button"
      tabIndex={selectionMode ? -1 : 0}
      onClickCapture={handleClickCapture}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleRowClick(e)
        }
      }}
      className={`ref-tx-row ref-tx-row--v2${selected ? ' ref-tx-row--selected' : ''}${selectionMode ? ' ref-tx-row--selection-mode' : ''}`}
    >
      <div className="ref-tx-icon-cell">
        {onToggleSelect ? (
          <label className="ref-tx-select" title={selected ? 'Desmarcar' : 'Selecionar'}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Selecionar transação ${descricaoExibir || catNome}`}
            />
            <span className="ref-tx-select__box" aria-hidden>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          </label>
        ) : null}
        <div
          className={`ref-tx-arrow-wrap ${isRec ? 'ref-tx-arrow-wrap--up' : 'ref-tx-arrow-wrap--down'}${getCategoriaIconChipStyle(catNome, subNome || undefined) ? ' cat-chip' : ''}`}
          style={getCategoriaIconChipStyle(catNome, subNome || undefined) || undefined}
          aria-hidden
        >
          <TransacaoCategoriaIcon
            categoriaNome={catNome}
            subcategoriaNome={subNome || undefined}
            isReceita={isRec}
            size={26}
          />
        </div>
      </div>
      <div className="ref-tx-content-cell">
        <div className="ref-tx-content-cell__primary">
          <span className="ref-tx-title" title={titulo}>{titulo}</span>
          {t.recorrente_index ? (
            <span className="ref-tx-rec-badge" title={`Parcela ${t.recorrente_index}/${t.recorrente_total}`}>
              {t.recorrente_index}/{t.recorrente_total}
            </span>
          ) : null}
          {mostraIconeRecorrente && !t.recorrente_index ? (
            <span
              className="ref-tx-recorrencia-ico-wrap"
              title="Lançamento recorrente"
              aria-label="Lançamento recorrente"
            >
              <RecorrenciaArrowIcon size={13} className="ref-tx-recorrencia-ico" />
            </span>
          ) : null}
        </div>
        <div className="ref-tx-content-cell__meta">
          <time className="ref-tx-date" dateTime={dateTimeAttr}>{dateLine}</time>
          {showCatNoMeta ? (
            <>
              <span className="ref-tx-meta-sep" aria-hidden>·</span>
              <span className="ref-tx-cat-inline">
                {catNome}
                {subNome ? (
                  <>
                    <span className="ref-tx-cat-inline__arrow" aria-hidden> › </span>
                    <span className="ref-tx-cat-inline__sub">{subNome}</span>
                  </>
                ) : null}
              </span>
            </>
          ) : subNome ? (
            <>
              <span className="ref-tx-meta-sep" aria-hidden>·</span>
              <span className="ref-tx-cat-inline__sub">{subNome}</span>
            </>
          ) : null}
          {mostrarQuemLancou && t.lancado_por_nome ? (
            <>
              <span className="ref-tx-meta-sep" aria-hidden>·</span>
              <span className={`ref-tx-lancador ${privacyMode ? 'privacy-blur' : ''}`} title="Quem registrou">
                {t.lancado_por_nome}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="ref-tx-val-cell">
        {isPendente ? (
          <span className="ref-tx-pendente-pill" aria-label="Parcela futura pendente">
            Pendente
          </span>
        ) : null}
        <span
          className={`ref-tx-val ${isRec ? 'ref-tx-val--pos' : 'ref-tx-val--neg'} ${privacyMode ? 'privacy-blur' : ''}`}
        >
          <span className="ref-tx-val__amount">
            {isRec ? '+' : '−'}
            {formatCurrencyBRL(valorAbs)}
          </span>
        </span>
      </div>
      <div className="ref-tx-actions-cell">
        <div className="transacoes-actions" role="group" aria-label="Ações da transação">
          <button
            type="button"
            className="btn-edit"
            onClick={() => onEdit(t)}
            aria-label={`Editar transação ${titulo}`}
            title="Editar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button
            type="button"
            className="btn-delete"
            onClick={() => onDelete(t)}
            aria-label={`Excluir transação ${titulo}`}
            title="Excluir"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
