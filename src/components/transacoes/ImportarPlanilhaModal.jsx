import { useRef, useState, useEffect } from 'react'
import { readHorizonteUser } from '../../lib/horizonteSession'
import { BankBadge } from './BankBadge'

const ACCEPT = '.xlsx,.xls,.csv,.pdf,.ofx,.qfx'
const MAX_EXCEL_MB = 10
const MAX_PDF_MB = 20

const FORMAT_LABELS = {
  xlsx: 'Excel (.xlsx)',
  xls: 'Excel (.xls)',
  csv: 'CSV',
  pdf: 'PDF',
  ofx: 'OFX',
  qfx: 'QFX',
}

const LOADING_STAGES = [
  'Lendo arquivo…',
  'Identificando transações…',
  'Categorizando com IA…',
  'Quase pronto…',
]

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function getExt(name) {
  return String(name || '').split('.').pop().toLowerCase()
}

function isPdf(ext) { return ext === 'pdf' }

function fileSizeError(file) {
  const ext = getExt(file.name)
  const maxMb = isPdf(ext) ? MAX_PDF_MB : MAX_EXCEL_MB
  if (file.size > maxMb * 1024 * 1024) {
    return `Arquivo muito grande. Máximo: ${maxMb}MB para ${FORMAT_LABELS[ext] || ext.toUpperCase()}.`
  }
  return null
}

function fmtMesAno(iso) {
  if (!iso) return null
  const [y, m] = iso.split('-')
  return `${MESES[parseInt(m, 10) - 1]}/${y}`
}

function formatPeriodo(inicio, fim) {
  if (!inicio) return null
  const a = fmtMesAno(inicio)
  const b = fmtMesAno(fim)
  return a === b ? a : `${a} – ${b}`
}

function formatResumo(data) {
  const parts = []
  if (data.importadas) parts.push(`✅ ${data.importadas} transação${data.importadas !== 1 ? 'ões' : ''} importada${data.importadas !== 1 ? 's' : ''}`)
  if (data.ignoradas) parts.push(`↩️ ${data.ignoradas} já existia${data.ignoradas !== 1 ? 'm' : ''}`)
  if (data.semCategoria) parts.push(`⚠️ ${data.semCategoria} sem categoria — "Outros"`)
  if (data.erros) parts.push(`❌ ${data.erros} com erro`)
  return parts
}

export function ImportarPlanilhaModal({ onClose, onSuccess }) {
  const user = readHorizonteUser()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [clientError, setClientError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [result, setResult] = useState(null)
  const [serverError, setServerError] = useState(null)

  useEffect(() => {
    if (!loading) { setLoadingStage(0); return }
    const delays = [2000, 4000, 8000]
    const timers = delays.map((d, i) =>
      setTimeout(() => setLoadingStage(i + 1), d)
    )
    return () => timers.forEach(clearTimeout)
  }, [loading])

  function handleFile(f) {
    if (!f) return
    const ext = getExt(f.name)
    if (!Object.keys(FORMAT_LABELS).includes(ext)) {
      setClientError(`Formato não suportado. Use: ${Object.values(FORMAT_LABELS).join(', ')}.`)
      setFile(null)
      return
    }
    const sizeErr = fileSizeError(f)
    if (sizeErr) { setClientError(sizeErr); setFile(null); return }
    setClientError(null)
    setServerError(null)
    setResult(null)
    setFile(f)
  }

  function handleReset() {
    setResult(null)
    setFile(null)
    setServerError(null)
    setClientError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function onInputChange(e) { handleFile(e.target.files?.[0]) }
  function onDrop(e) { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }
  function onDragOver(e) { e.preventDefault(); setDragging(true) }
  function onDragLeave() { setDragging(false) }

  async function handleSubmit() {
    if (!file || loading) return
    setLoading(true)
    setServerError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('arquivo', file)

    try {
      const res = await fetch('/api/import/planilha', {
        method: 'POST',
        body: formData,
        headers: { 'x-user-id': user?.id || user?.usuario_id || '' },
      })
      const json = await res.json()
      if (!res.ok) {
        setServerError(json.message || 'Erro ao processar o arquivo.')
      } else {
        setResult(json)
      }
    } catch {
      setServerError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const resumoLines = result ? formatResumo(result) : []
  const periodo = result ? formatPeriodo(result.periodoInicio, result.periodoFim) : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box import-planilha-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📊 Importar Planilha</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="modal-body">
          {!result ? (
            <>
              <p className="import-subtitle">
                Envie seu extrato bancário e o Severino importa e categoriza automaticamente.
              </p>

              <div
                className={`import-dropzone${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => !loading && inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && !loading && inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" accept={ACCEPT} onChange={onInputChange} style={{ display: 'none' }} />
                {loading ? (
                  <div className="import-loading-state">
                    <span className="import-loading-spinner" />
                    <span className="import-loading-text">{LOADING_STAGES[loadingStage]}</span>
                  </div>
                ) : file ? (
                  <div className="import-file-selected">
                    <span className="import-file-icon">📄</span>
                    <span className="import-file-name">{file.name}</span>
                    <span className="import-file-size">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                ) : (
                  <div className="import-dropzone-hint">
                    <span className="import-drop-icon">⬆️</span>
                    <span>Clique ou arraste o arquivo aqui</span>
                    <span className="import-formats">.xlsx · .xls · .csv · .pdf · .ofx · .qfx</span>
                    <span className="import-banks-hint">OFX exportado direto pelo banco (Bradesco, Itaú, BB, Caixa…)</span>
                  </div>
                )}
              </div>

              {clientError && <p className="import-error">{clientError}</p>}
              {serverError && <p className="import-error">{serverError}</p>}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={!file || loading}
                >
                  {loading ? LOADING_STAGES[loadingStage] : 'Importar'}
                </button>
              </div>
            </>
          ) : (
            <div className="import-result">
              {(result.banco || periodo) && (
                <div className="import-bank-detected">
                  {result.banco && (
                    <>
                      <BankBadge banco={result.banco} />
                      <span className="import-bank-name">{result.banco.nome}</span>
                    </>
                  )}
                  {periodo && <span className="import-period">{periodo}</span>}
                </div>
              )}
              <div className="import-result-lines">
                {resumoLines.map((line, i) => <p key={i}>{line}</p>)}
                {!resumoLines.length && <p>Nenhuma transação nova encontrada.</p>}
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleReset}>← Importar outro</button>
                <button className="btn-primary" onClick={() => { onSuccess?.(); onClose() }}>Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
