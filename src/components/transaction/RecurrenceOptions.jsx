import React from 'react'
import RecorrenciaArrowIcon from '../RecorrenciaArrowIcon'

/**
 * RecurrenceOptions — Seção de configuração de recorrência mensal.
 * Só renderiza no modo de criação (não edição).
 */
const RecurrenceOptions = ({ checked, onChange }) => {
  return (
    <section
      className={`nova-tx-section nova-tx-section--recorrencia ${checked ? 'nova-tx-section--recorrencia-on' : ''}`}
      aria-labelledby="nova-tx-h-recorrencia"
    >
      <h4 id="nova-tx-h-recorrencia" className="nova-tx-section__title">
        Recorrência
      </h4>
      <div className={`form-group form-group--recorrencia ${checked ? 'form-group--recorrencia-on' : ''}`}>
        <label htmlFor="tx-recorrencia-dia-1" className="modal-recorrencia-toggle-row">
          <span className="modal-recorrencia-toggle-row__iconWrap" aria-hidden>
            <RecorrenciaArrowIcon size={20} className="modal-recorrencia-toggle-row__icon" />
          </span>
          <span className="modal-recorrencia-toggle-row__text">Repetir todo mês neste dia</span>
          <input
            id="tx-recorrencia-dia-1"
            type="checkbox"
            name="recorrencia_dia_1"
            checked={checked}
            onChange={onChange}
            className="modal-recorrencia-toggle-row__checkbox"
          />
        </label>
      </div>
    </section>
  )
}

export default RecurrenceOptions
