import React, { useEffect, useId } from 'react'
import {
  aliquotaIrRendaFixaPfPorPrazoDias,
  contarDiasUteisComJurosDesdeIso,
  diasCorridosDesdeIso,
  estimativaRendimentoAcumuladoAteHoje,
  extrairYyyyMmDdReferencia,
  formatAliquotaIrPtBr,
  investimentoIsentoIrPessoaFisica,
} from '../../lib/investimentosRendimentoIr'
import { isoParaCalculoDias } from '../../lib/investimentosUtils'
import { formatCurrencyBRL } from '../../lib/formatCurrency'

function formatDataBr(ymd) {
  if (!ymd) return '—'
  try {
    return new Date(`${ymd}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ymd
  }
}

export default function InvestimentoAportesDetalheModal({
  open,
  onClose,
  investimento,
  cdiAa,
  onRemoverAporte,
  removendoAporteId,
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open || !investimento) return null

  const aportes = investimento.aportes ?? []
  const percNum = Number(investimento.percentual_cdi)
  const percOk = Number.isFinite(percNum) && percNum > 0
  const isentoIr = investimentoIsentoIrPessoaFisica(investimento.tipo_preset)
  const tipoIndexador = investimento.tipo_indexador ?? 'CDI'
  const isPrefixado = tipoIndexador === 'PREFIXADO'
  const cdiDisponivel = cdiAa != null && Number.isFinite(cdiAa) && cdiAa > 0
  const podeCalcular = percOk && (cdiDisponivel || isPrefixado)

  return (
    <div
      className="modal-backdrop page-investimentos-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-content page-investimentos-modal page-investimentos-aportes-modal">
        <div className="modal-header">
          <h3 id={titleId} className="modal-title">
            Aportes — {investimento.nome ?? 'Investimento'}
          </h3>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="page-investimentos-aportes-modal__intro">
            Cada aporte tem seu próprio timer de IR regressivo. O prazo conta individualmente a partir da data de cada aporte.
          </p>

          {aportes.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Nenhum aporte registado.</p>
          ) : (
            <div className="page-investimentos-aportes-table-wrap">
              <table className="page-investimentos-aportes-table" aria-label="Aportes do investimento">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Valor aportado</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Dias</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Alíquota IR</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Bruto acum.</th>
                    <th scope="col" style={{ textAlign: 'right' }}>IR acum.</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Líquido acum.</th>
                    <th scope="col">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {aportes.map((aporte) => {
                    const isoCalc = isoParaCalculoDias(aporte.data_aquisicao, aporte.criado_em)
                    const diasCorridos = diasCorridosDesdeIso(isoCalc)
                    const diasUteis = contarDiasUteisComJurosDesdeIso(isoCalc)

                    const aliq = isentoIr ? 0 : aliquotaIrRendaFixaPfPorPrazoDias(diasCorridos ?? 0)
                    const aliqFmt = isentoIr ? 'Isento (PF)' : formatAliquotaIrPtBr(aliq)

                    const estAcum = podeCalcular
                      ? estimativaRendimentoAcumuladoAteHoje(
                          aporte.valor,
                          percNum,
                          cdiAa,
                          diasCorridos,
                          isentoIr,
                          diasUteis ?? 0,
                          tipoIndexador,
                        )
                      : null

                    const isUnico = aportes.length === 1
                    const removendo = removendoAporteId === aporte.id

                    return (
                      <tr key={aporte.id}>
                        <td data-label="Data">
                          <time dateTime={extrairYyyyMmDdReferencia(aporte.data_aquisicao) ?? ''}>
                            {formatDataBr(aporte.data_aquisicao)}
                          </time>
                        </td>
                        <td className="num" data-label="Valor aportado">
                          {formatCurrencyBRL(aporte.valor)}
                        </td>
                        <td className="num" data-label="Dias (corridos)">
                          {diasCorridos != null ? diasCorridos : '—'}
                        </td>
                        <td className="num" data-label="Alíquota IR">
                          {aliqFmt}
                        </td>
                        <td className="num pos" data-label="Bruto acum.">
                          {estAcum ? formatCurrencyBRL(estAcum.brutoAcumulado) : '—'}
                        </td>
                        <td className="num" data-label="IR acum.">
                          {estAcum
                            ? estAcum.isento
                              ? 'Isento'
                              : formatCurrencyBRL(estAcum.impostoAcumulado)
                            : '—'}
                        </td>
                        <td className="num pos" data-label="Líquido acum.">
                          {estAcum ? formatCurrencyBRL(estAcum.liquidoAcumulado) : '—'}
                        </td>
                        <td data-label="Ação">
                          <button
                            type="button"
                            className="page-investimentos-aportes-table__remove"
                            disabled={isUnico || removendo}
                            title={isUnico ? 'Investimento precisa de ao menos 1 aporte' : 'Remover aporte'}
                            onClick={() => onRemoverAporte?.(investimento.id, aporte.id)}
                          >
                            {removendo ? '…' : 'Remover'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="page-investimentos-aportes-modal__footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
