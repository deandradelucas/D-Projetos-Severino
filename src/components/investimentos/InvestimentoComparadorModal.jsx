import React, { useId, useMemo, useRef, useState } from 'react'
import { useSheetDragClose } from '../../hooks/useSheetDragClose'
import DatePickerBrPopover from './DatePickerBrPopover'
import { maskDateBrInput, parseDdMmYyyyStrict, ymdToDdMmYyyy } from '../../lib/dateInputBr'
import { maskCurrencyBRLInput, parseCurrencyBRLMasked, valorToMaskedBRL } from '../../lib/currencyMaskBr'
import { formatCurrencyBRL } from '../../lib/formatCurrency'
import { INVESTIMENTOS_PRESETS_LIST } from '../../lib/investimentosPresets'
import {
  contarDiasUteisComJurosAteYmd,
  diasCorridosEntreReferenciasIso,
  estimativaRendimentoAcumuladoAteHoje,
  investimentoIsentoIrPessoaFisica,
} from '../../lib/investimentosRendimentoIr'
import { ymdLocalFromDate, ymdMaxProjecaoLocal, formatYmdPtBr } from '../../lib/investimentosUtils'

const SLOT_DEFAULTS = [
  { preset: 'LCA', percInput: '90', label: 'LCA 90% CDI', indexador: 'CDI' },
  { preset: 'CDB', percInput: '110', label: 'CDB 110% CDI', indexador: 'CDI' },
  { preset: null, percInput: '13', label: 'Pré-fixado 13% a.a.', indexador: 'PREFIXADO' },
]

function calcSlot(slot, valorNum, prazoYmd, cdiAa) {
  if (!valorNum || !prazoYmd || !cdiAa) return null
  const hojeIso = `${ymdLocalFromDate()}T12:00:00`
  const isento = slot.preset ? investimentoIsentoIrPessoaFisica(slot.preset) : false
  const perc = Number(slot.percInput.replace(',', '.'))
  if (!Number.isFinite(perc) || perc <= 0) return null
  const dc = diasCorridosEntreReferenciasIso(hojeIso, prazoYmd)
  const du = contarDiasUteisComJurosAteYmd(hojeIso, prazoYmd)
  if (!dc || !du) return null
  return estimativaRendimentoAcumuladoAteHoje(valorNum, perc, cdiAa, dc, isento, du, slot.indexador)
}

export default function InvestimentoComparadorModal({ open, onClose, cdiAa }) {
  const titleId = useId()
  const sheetRef = useRef(null)
  const btnCalRef = useRef(null)
  useSheetDragClose(sheetRef, { open, onClose })
  const [valorInput, setValorInput] = useState(valorToMaskedBRL(10000))
  const [prazoBr, setPrazoBr] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [slots, setSlots] = useState(SLOT_DEFAULTS)

  const hojeYmd = ymdLocalFromDate()
  const maxYmd = ymdMaxProjecaoLocal()
  const prazoYmd = useMemo(() => parseDdMmYyyyStrict(prazoBr), [prazoBr])

  const valorNum = useMemo(() => {
    const v = parseCurrencyBRLMasked(valorInput)
    return Number.isFinite(v) && v > 0 ? v : null
  }, [valorInput])

  const prazoValido = prazoYmd && prazoYmd > hojeYmd

  const resultados = useMemo(() => {
    if (!valorNum || !prazoValido || !cdiAa) return null
    return slots.map((s) => ({ ...s, result: calcSlot(s, valorNum, prazoYmd, cdiAa) }))
  }, [slots, valorNum, prazoValido, prazoYmd, cdiAa])

  const melhorIdx = useMemo(() => {
    if (!resultados) return -1
    let max = -Infinity, idx = -1
    resultados.forEach((r, i) => {
      if (r.result && r.result.liquidoAcumulado > max) { max = r.result.liquidoAcumulado; idx = i }
    })
    return idx
  }, [resultados])

  function updateSlot(i, field, value) {
    setSlots((prev) => prev.map((s, j) => j === i ? { ...s, [field]: value } : s))
  }

  if (!open) return null

  return (
    <>
    <div className="modal-backdrop page-investimentos-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content page-investimentos-modal page-investimentos-comparador" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id={titleId}>Comparador de investimentos</h3>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Fechar"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg></button>
        </div>
        <div className="modal-body page-investimentos-modal__body">
          <div className="page-investimentos-comparador__controls">
            <div className="page-investimentos-comparador__field">
              <label className="page-investimentos-modal__section-label">Valor a investir</label>
              <input
                type="text"
                inputMode="numeric"
                className="page-investimentos-modal__input"
                value={valorInput}
                onChange={(e) => setValorInput(maskCurrencyBRLInput(e.target.value))}
              />
            </div>
            <div className="page-investimentos-comparador__field">
              <label className="page-investimentos-modal__section-label">Prazo (data de resgate)</label>
              <div className="page-investimentos-modal__date-field-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="dd/mm/aaaa"
                  lang="pt-BR"
                  className="page-investimentos-modal__input page-investimentos-modal__input--date-br"
                  value={prazoBr}
                  onChange={(e) => setPrazoBr(maskDateBrInput(e.target.value))}
                />
                <button
                  ref={btnCalRef}
                  type="button"
                  className="page-investimentos-modal__date-cal-btn"
                  aria-label="Abrir calendário — prazo de resgate"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen((v) => !v)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {!cdiAa && (
            <p className="page-investimentos-comparador__cdi-aviso">Taxa CDI indisponível no momento — resultados para CDI não serão calculados.</p>
          )}

          <div className="page-investimentos-comparador__slots">
            {slots.map((slot, i) => (
              <div key={i} className={`page-investimentos-comparador__slot${melhorIdx === i ? ' page-investimentos-comparador__slot--melhor' : ''}`}>
                {melhorIdx === i && <span className="page-investimentos-comparador__melhor-badge">Melhor opção</span>}
                <div className="page-investimentos-comparador__slot-head">
                  <select
                    className="page-investimentos-comparador__select"
                    value={slot.indexador}
                    onChange={(e) => updateSlot(i, 'indexador', e.target.value)}
                    aria-label="Tipo de indexador"
                  >
                    <option value="CDI">% do CDI</option>
                    <option value="PREFIXADO">Pré-fixado a.a.</option>
                  </select>
                  <select
                    className="page-investimentos-comparador__select"
                    value={slot.preset ?? ''}
                    onChange={(e) => updateSlot(i, 'preset', e.target.value || null)}
                    aria-label="Tipo de produto"
                  >
                    <option value="">Personalizado</option>
                    {INVESTIMENTOS_PRESETS_LIST.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="page-investimentos-comparador__slot-taxa">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="page-investimentos-comparador__taxa-input"
                    value={slot.percInput}
                    onChange={(e) => updateSlot(i, 'percInput', e.target.value)}
                    aria-label={slot.indexador === 'PREFIXADO' ? 'Taxa % a.a.' : '% do CDI'}
                  />
                  <span className="page-investimentos-comparador__taxa-suf">
                    {slot.indexador === 'PREFIXADO' ? '% a.a.' : '% CDI'}
                  </span>
                </div>
                {resultados && resultados[i].result ? (
                  <div className="page-investimentos-comparador__resultado">
                    <div className="page-investimentos-comparador__res-row">
                      <span>Bruto acumulado</span>
                      <strong>{formatCurrencyBRL(resultados[i].result.brutoAcumulado)}</strong>
                    </div>
                    <div className="page-investimentos-comparador__res-row page-investimentos-comparador__res-row--ir">
                      <span>IR est.</span>
                      <span>{resultados[i].result.isento ? 'Isento (PF)' : `− ${formatCurrencyBRL(resultados[i].result.impostoAcumulado)}`}</span>
                    </div>
                    <div className="page-investimentos-comparador__res-row page-investimentos-comparador__res-row--liq">
                      <span>Líquido</span>
                      <strong className="page-investimentos-comparador__liq-value">{formatCurrencyBRL(resultados[i].result.liquidoAcumulado)}</strong>
                    </div>
                    <div className="page-investimentos-comparador__res-row page-investimentos-comparador__res-row--total">
                      <span>Total em {formatYmdPtBr(prazoYmd)}</span>
                      <strong>{formatCurrencyBRL((valorNum ?? 0) + resultados[i].result.liquidoAcumulado)}</strong>
                    </div>
                  </div>
                ) : prazoValido && valorNum && cdiAa ? (
                  <p className="page-investimentos-comparador__res-vazio">Verifique a taxa.</p>
                ) : (
                  <p className="page-investimentos-comparador__res-vazio">Preencha valor e prazo.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <DatePickerBrPopover
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      anchorRef={btnCalRef}
      valueYmd={prazoYmd}
      onSelectYmd={(ymd) => setPrazoBr(ymdToDdMmYyyy(ymd))}
      minYmd={hojeYmd}
      maxYmd={maxYmd}
    />
    </>
  )
}
