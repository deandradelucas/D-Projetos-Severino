import React, { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalA11y } from '../../hooks/useModalA11y'

/**
 * Modal com QR Code Pix (Asaas) + copia e cola.
 * Renderizado via portal no document.body para abrir como overlay centralizado
 * em qualquer dispositivo (escapa do scroll container da página).
 */
export default function PagamentoPixQrModal({
  open,
  onClose,
  loading,
  error,
  needsCpf,
  cpfCnpj,
  onCpfCnpjChange,
  pixData,
  onGerar,
}) {
  const titleId = useId()
  const modalRef = useRef(null)
  useModalA11y({ open, onClose, containerRef: modalRef })
  if (!open) return null

  const imgSrc =
    pixData?.encoded_image && String(pixData.encoded_image).trim()
      ? `data:image/png;base64,${String(pixData.encoded_image).trim()}`
      : ''

  return createPortal(
    <div className="pagamento-pix-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="pagamento-pix-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pagamento-pix-modal__head">
          <h2 id={titleId} className="pagamento-pix-modal__title">
            Pix — plano anual (Asaas)
          </h2>
          <button type="button" className="pagamento-pix-modal__close" onClick={onClose} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>
        <p className="pagamento-pix-modal__intro">
          Gera uma cobrança Pix avulsa no valor do plano anual. Após o pagamento, use &quot;Atualizar status&quot; na página Pagamento.
        </p>
        {needsCpf ? (
          <label className="pagamento-pix-modal__field">
            <span className="pagamento-pix-modal__label">CPF ou CNPJ (só números)</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="pagamento-pix-modal__input"
              placeholder="00000000000 ou 00000000000000"
              value={cpfCnpj}
              onChange={(e) => onCpfCnpjChange(e.target.value)}
            />
          </label>
        ) : null}
        {error ? (
          <p className="pagamento-pix-modal__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pagamento-pix-modal__actions">
          <button type="button" className="btn-secondary" disabled={loading} onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="btn-primary" disabled={loading} onClick={onGerar}>
            {loading ? 'A gerar…' : pixData ? 'Atualizar QR' : 'Gerar QR Code'}
          </button>
        </div>
        {pixData?.payment_id ? (
          <p className="pagamento-pix-modal__meta">
            Cobrança: <code>{pixData.payment_id}</code>
            {pixData.expiration_date ? ` · válido até ${pixData.expiration_date}` : null}
          </p>
        ) : null}
        {imgSrc ? (
          <div className="pagamento-pix-modal__qr">
            <img src={imgSrc} alt="QR Code para pagamento Pix" width={220} height={220} decoding="async" />
          </div>
        ) : null}
        {pixData?.payload ? (
          <div className="pagamento-pix-modal__payload">
            <label className="pagamento-pix-modal__label" htmlFor="pagamento-pix-payload">
              Pix copia e cola
            </label>
            <textarea id="pagamento-pix-payload" className="pagamento-pix-modal__textarea" readOnly rows={4} value={pixData.payload} />
            <button
              type="button"
              className="btn-secondary pagamento-pix-modal__copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pixData.payload)
                } catch {
                  /* ignore */
                }
              }}
            >
              Copiar código
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
