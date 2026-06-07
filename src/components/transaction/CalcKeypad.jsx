// Teclado da calculadora inline do modal de transação — widget autocontido.
// Extraído de components/TransactionModal.jsx (relocação pura).
export default function CalcKeypad({ calcRef, expr, onAppend, onBackspace, onClear, onSubmit }) {
  return (
    <div className="ntx-calc" ref={calcRef}>
      <div className="ntx-calc__display" aria-live="polite">{expr || '0'}</div>
      <div className="ntx-calc__pad">
        {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', ',', '⌫', '+'].map((k) => (
          <button
            key={k}
            type="button"
            className={`ntx-calc__key${'÷×−+'.includes(k) ? ' ntx-calc__key--op' : ''}${k === '⌫' ? ' ntx-calc__key--del' : ''}`}
            onClick={() => (k === '⌫' ? onBackspace() : onAppend(k))}
            aria-label={k === '⌫' ? 'Apagar' : k}
          >
            {k}
          </button>
        ))}
        <button type="button" className="ntx-calc__key ntx-calc__key--clear" onClick={onClear}>C</button>
        <button type="button" className="ntx-calc__key ntx-calc__key--eq" onClick={onSubmit} aria-label="Calcular e usar">=</button>
      </div>
    </div>
  )
}
