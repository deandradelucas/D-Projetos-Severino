import React from 'react'
import { formatCurrencyBRL } from '../../lib/formatCurrency'
import { vencimentoCartaoParaData } from '../../lib/cartaoVencimento'

/**
 * Grupo de compra parcelada (ou recorrência mensal) com:
 * - Header com ícone, descrição, meta, barra de progresso, valor, status
 * - Chips: próxima parcela, "atrasada", "concluída"
 * - Botão "Quitar antecipado" e "Editar grupo"
 * - Lista expandida de parcelas com "Marcar paga" inline
 */
export function ParceladoGroup({
  g,
  isMensal,
  expandido,
  onToggle,
  onMarcarPaga,
  onQuitarAntecipado,
  onEditParcela,
  onEditGrupo,
  onDeleteParcela,
  privacyMode,
}) {
  const isRec = g.tipo === 'RECEITA'
  const catNome = (g.categorias?.nome && String(g.categorias.nome).trim()) || '—'
  const subNome = g.subcategorias?.nome && String(g.subcategorias.nome).trim() ? String(g.subcategorias.nome).trim() : ''
  const valorCabecalho = isMensal ? Math.abs(parseFloat(g.parcelas[0]?.valor) || 0) : g.valor_total
  // Total já gasto na assinatura: soma das ocorrências efetivadas (não conta pendentes)
  const totalGasto = (g.parcelas || [])
    .filter((p) => p.status !== 'PENDENTE')
    .reduce((acc, p) => acc + Math.abs(parseFloat(p.valor) || 0), 0)

  const fmtData = (raw) => {
    if (!raw) return '—'
    // Data só com dia (YYYY-MM-DD, ex.: vencimento do cartão) → parse LOCAL para não
    // deslocar um dia (new Date('2026-07-10') seria meia-noite UTC = 09/jul em BRT).
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw))
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(raw)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  // Cartão vinculado (vem embutido na transação): nome + próximo vencimento.
  const cartao = g.cartao || g.parcelas?.[0]?.cartoes || null
  const cartaoNome = cartao?.nome ? String(cartao.nome).trim() : ''
  // Para assinaturas mensais com cartão, o débito cai no vencimento do cartão:
  // mostramos o PRÓXIMO vencimento a partir de hoje (1º dia de vencimento >= hoje).
  const proxVencimento =
    isMensal && cartao?.dia_vencimento
      ? vencimentoCartaoParaData(new Date().toISOString().slice(0, 10), cartao.dia_vencimento, 0)
      : ''

  return (
    <li className={`page-transacoes-parcelado-grupo${expandido ? ' page-transacoes-parcelado-grupo--open' : ''}${isMensal ? ' page-transacoes-parcelado-grupo--mensal' : ''} parc-grupo--${g.status}`}>
      <button
        type="button"
        className="page-transacoes-parcelado-grupo__head parc-grupo-head"
        onClick={onToggle}
        aria-expanded={expandido}
        aria-controls={`parcelas-${g.id}`}
      >
        <span className="page-transacoes-parcelado-grupo__icon" aria-hidden>
          {isMensal ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4M14 15h4" />
            </svg>
          )}
        </span>
        <div className="page-transacoes-parcelado-grupo__main parc-grupo-main">
          <div className="parc-grupo-title-row">
            <span className="page-transacoes-parcelado-grupo__desc">{g.descricao_base}</span>
            {cartaoNome ? (
              <span className="parc-cartao-chip" title={`Cartão: ${cartaoNome}`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                </svg>
                {cartaoNome}
              </span>
            ) : null}
          </div>
          <span className="page-transacoes-parcelado-grupo__meta">
            {isMensal
              ? `Mensal · sem prazo · ${g.parcelas.length} ${g.parcelas.length === 1 ? 'lançamento' : 'lançamentos'}`
              : `${g.parcelas_pagas} de ${g.parcelas_total} pagas`} · {catNome}{subNome ? ` · ${subNome}` : ''}
          </span>
          {/* Barra de progresso (somente parcelado, não mensal) */}
          {!isMensal && (
            <div className="parc-progress">
              <span
                className="parc-progress__track"
                role="progressbar"
                aria-valuenow={g.parcelas_pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span className="parc-progress__bar" style={{ width: `${g.parcelas_pct}%` }} />
              </span>
              <span className="parc-progress__label">{g.parcelas_pct}%</span>
            </div>
          )}
          {/* Pago / restante (somente parcelado) */}
          {!isMensal && (
            <div className={`parc-pago-restante ${privacyMode ? 'privacy-blur' : ''}`}>
              <span className="parc-pago-restante__pago">Pago {formatCurrencyBRL(g.valor_pago)}</span>
              <span className="parc-pago-restante__sep" aria-hidden>·</span>
              <span className="parc-pago-restante__restante">Falta {formatCurrencyBRL(g.valor_restante)}</span>
            </div>
          )}
          {/* Chips: status (quitada/atrasada) + vencimento (mensal) + próxima parcela */}
          {(g.status === 'concluida' || g.status === 'atrasada' || proxVencimento || (g.proxima_parcela && g.status !== 'concluida')) && (
            <div className="parc-chips">
              {proxVencimento && (
                <span className="parc-venc-chip" title="Próximo vencimento no cartão">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  Vence {fmtData(proxVencimento)}
                </span>
              )}
              {g.status === 'concluida' && (
                <span className="parc-status-badge parc-status-badge--concluida" title="Todas as parcelas pagas">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  Quitada
                </span>
              )}
              {g.status === 'atrasada' && (
                <span className="parc-status-badge parc-status-badge--atrasada" title="Tem parcela vencida e pendente">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M4.93 19.07a10 10 0 1 1 14.14 0" /></svg>
                  Atrasada
                </span>
              )}
              {g.proxima_parcela && g.status !== 'concluida' && (
                <span className={`parc-proxima-chip ${privacyMode ? 'privacy-blur' : ''}`} title="Próxima parcela">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  Próxima: {fmtData(g.proxima_parcela.data_transacao)} · {formatCurrencyBRL(Math.abs(parseFloat(g.proxima_parcela.valor) || 0))}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="page-transacoes-parcelado-grupo__right">
          <span className="parc-valor-stack">
            <span className={`page-transacoes-parcelado-grupo__valor${isRec ? ' page-transacoes-parcelado-grupo__valor--rec' : ''} ${privacyMode ? 'privacy-blur' : ''}`}>
              {isRec ? '+' : '−'}
              {formatCurrencyBRL(valorCabecalho)}
              {isMensal ? <span className="page-transacoes-parcelado-grupo__valor-suf">/mês</span> : null}
            </span>
            {isMensal && totalGasto > 0 ? (
              <span className={`parc-total-gasto ${privacyMode ? 'privacy-blur' : ''}`} title="Total já gasto nesta assinatura">
                Total {formatCurrencyBRL(totalGasto)}
              </span>
            ) : null}
          </span>
          <span className="page-transacoes-parcelado-grupo__chev" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </div>
      </button>

      {expandido && (
        <div className="parc-expanded">
          {/* Ações do grupo */}
          {g.status !== 'concluida' && (
            <div className="parc-group-actions">
              <button type="button" className="parc-group-action parc-group-action--primary" onClick={(e) => { e.stopPropagation(); onQuitarAntecipado() }}>
                Quitar antecipado
              </button>
              <button type="button" className="parc-group-action" onClick={(e) => { e.stopPropagation(); onEditGrupo() }}>
                Editar grupo
              </button>
            </div>
          )}
          <ul id={`parcelas-${g.id}`} className="page-transacoes-parcelado-grupo__parcelas">
            {g.parcelas.map((p, idx) => {
              const valorAbs = Math.abs(parseFloat(p.valor) || 0)
              const isPendente = p.status === 'PENDENTE'
              return (
                <li key={p.id} className="page-transacoes-parcelado-parcela">
                  <span className="page-transacoes-parcelado-parcela__idx">
                    {isMensal ? `${idx + 1}ª` : `${p.recorrente_index}/${p.recorrente_total}`}
                  </span>
                  <span className="page-transacoes-parcelado-parcela__data">{fmtData(p.data_transacao)}</span>
                  <span className={`page-transacoes-parcelado-parcela__status${isPendente ? ' page-transacoes-parcelado-parcela__status--pendente' : ' page-transacoes-parcelado-parcela__status--pago'}`}>
                    {isPendente ? 'Pendente' : 'Pago'}
                  </span>
                  <span className={`page-transacoes-parcelado-parcela__valor ${privacyMode ? 'privacy-blur' : ''}`}>
                    {formatCurrencyBRL(valorAbs)}
                  </span>
                  <div className="page-transacoes-parcelado-parcela__acoes" role="group">
                    {isPendente ? (
                      <button
                        type="button"
                        className="btn-marcar-paga"
                        onClick={(e) => { e.stopPropagation(); onMarcarPaga(p) }}
                        aria-label="Marcar como paga"
                        title="Marcar como paga"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-edit"
                      onClick={(e) => { e.stopPropagation(); onEditParcela(p) }}
                      aria-label={`Editar parcela`}
                      title="Editar"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteParcela(p) }}
                      aria-label={`Excluir parcela`}
                      title="Excluir"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </li>
  )
}
