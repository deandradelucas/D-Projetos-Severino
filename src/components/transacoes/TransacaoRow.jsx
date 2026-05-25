import React from 'react'
import RecorrenciaArrowIcon from '../RecorrenciaArrowIcon'
import { TransacaoCategoriaIcon } from '../TransacaoCategoriaIcon'
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
export function TransacaoRow({ t, mostrarQuemLancou, privacyMode, onEdit, onDelete }) {
  const isRec = t.tipo === 'RECEITA'
  const { line: dateLine, dateTimeAttr } = formatTransacaoListDateTime(t.data_transacao)
  const catNome = (t.categorias?.nome && String(t.categorias.nome).trim()) || '—'
  const subRaw = t.subcategorias
  const subNome =
    subRaw && typeof subRaw === 'object' && subRaw.nome && String(subRaw.nome).trim()
      ? String(subRaw.nome).trim()
      : '—'
  const valorAbs = Math.abs(parseFloat(t.valor) || 0)
  const isParcela = Boolean(t.recorrente_index)
  const isRecorrente = !isParcela && Boolean(t.recorrencia_mensal_id)
  const mostraIconeRecorrente = isParcela || isRecorrente
  const isPendente = t.status === 'PENDENTE'
  const descricaoExibir = transacaoDescricaoEfetiva(t)

  return (
    <div key={t.id} className="ref-tx-row">
      <div className="ref-tx-icon-cell">
        <div className={`ref-tx-arrow-wrap ${isRec ? 'ref-tx-arrow-wrap--up' : 'ref-tx-arrow-wrap--down'}`} aria-hidden>
          <TransacaoCategoriaIcon
            categoriaNome={catNome}
            subcategoriaNome={subNome}
            isReceita={isRec}
            size={16}
          />
        </div>
      </div>
      <div className="ref-tx-meta-cell">
        <time className="ref-tx-date ref-tx-date--row-meta" dateTime={dateTimeAttr}>
          {dateLine}
        </time>
        {descricaoExibir ? (
          <span className="ref-tx-desc" title={descricaoExibir}>
            {descricaoExibir}
          </span>
        ) : null}
        {isPendente ? (
          <span className="ref-tx-pendente-chip" aria-label="Parcela futura pendente">Pendente</span>
        ) : null}
        {mostrarQuemLancou && t.lancado_por_nome ? (
          <span className={`ref-tx-lancador ${privacyMode ? 'privacy-blur' : ''}`} title="Quem registrou este lançamento">
            Lançado por {t.lancado_por_nome}
          </span>
        ) : null}
      </div>
      <div className="ref-tx-cat-cell">
        <span className="ref-tx-field-label">Categoria</span>
        <p className="ref-tx-cat-text">
          <span
            className={`ref-tx-tipo-pulse ${isRec ? 'ref-tx-tipo-pulse--receita' : 'ref-tx-tipo-pulse--despesa'}`}
            role="img"
            aria-label={isRec ? 'Receita' : 'Despesa'}
          />
          <span className="ref-tx-cat-text__label">
            {catNome}
            {t.recorrente_index ? (
              <span className="ref-tx-rec-badge">
                {t.recorrente_index}/{t.recorrente_total}
              </span>
            ) : null}
          </span>
        </p>
      </div>
      <div className="ref-tx-sub-cell">
        <span className="ref-tx-field-label">Subcategoria</span>
        <p className="ref-tx-sub-text">
          <span className="ref-tx-sub-text__name">{subNome}</span>
          <time className="ref-tx-date ref-tx-date--paired-sub" dateTime={dateTimeAttr}>
            {dateLine}
          </time>
        </p>
      </div>
      <div className="ref-tx-rec-cell">
        {mostraIconeRecorrente ? (
          <span
            className="ref-tx-recorrencia-ico-wrap"
            title={isParcela ? `Parcelamento ${t.recorrente_index}/${t.recorrente_total}` : 'Lançamento recorrente'}
            aria-label={isParcela ? `Parcela ${t.recorrente_index} de ${t.recorrente_total}` : 'Lançamento recorrente'}
          >
            {isParcela
              ? <ParcelamentoIcon />
              : <RecorrenciaArrowIcon size={14} className="ref-tx-recorrencia-ico" />
            }
          </span>
        ) : null}
      </div>
      <div className="ref-tx-val-act-wrap">
        <div className="ref-tx-val-cell">
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
              aria-label={`Editar transação ${descricaoExibir || subNome || catNome}`}
              title="Editar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <button
              type="button"
              className="btn-delete"
              onClick={() => onDelete(t)}
              aria-label={`Excluir transação ${descricaoExibir || subNome || catNome}`}
              title="Excluir"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
