import React, { useState, useEffect, useRef } from 'react'

const CustomSelect = ({ name, value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = options.find(o => String(o.id) === String(value))

  return (
    <div className={`custom-select ${isOpen ? 'open' : ''}`} ref={ref}>
      <input type="text" name={name} value={value} readOnly required className="sr-only" style={{ opacity: 0, position: 'absolute', zIndex: -1, width: '100%', height: '100%', bottom: 0, left: 0 }} />
      <div className="custom-select-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selected?.cor && <div className="category-dot" style={{ backgroundColor: selected.cor }} />}
          <span className={selected ? 'text-white' : 'text-placeholder'}>
            {selected ? selected.nome : placeholder}
          </span>
        </div>
        <svg className={`chevron ${isOpen ? 'rotate' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', transition: 'transform 0.2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
      <div className="custom-select-dropdown">
        <div className="custom-select-options">
          <div 
            className={`custom-select-option ${!value ? 'selected' : ''}`}
            onClick={() => { onChange({ target: { name, value: '' } }); setIsOpen(false) }}
          >
            {placeholder}
          </div>
          {options.map(opt => (
            <div 
              key={opt.id} 
              className={`custom-select-option ${String(value) === String(opt.id) ? 'selected' : ''}`}
              onClick={() => { onChange({ target: { name, value: opt.id } }); setIsOpen(false) }}
            >
              {opt.cor && <div className="category-dot" style={{ backgroundColor: opt.cor }} />}
              {opt.nome}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TransactionModal({ isOpen, onClose, onSave, usuarioId }) {
  const [categorias, setCategorias] = useState([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    tipo: 'DESPESA',
    data_transacao: new Date().toISOString().split('T')[0],
    categoria_id: '',
    subcategoria_id: ''
  })
  
  const [displayValor, setDisplayValor] = useState('')

  const fetchCategorias = React.useCallback(async () => {
    setLoadingCats(true)
    try {
      const res = await fetch('/api/categorias', {
        headers: { 'x-user-id': usuarioId }
      })
      if (res.ok) {
        const data = await res.json()
        setCategorias(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCats(false)
    }
  }, [usuarioId])

  useEffect(() => {
    if (isOpen && usuarioId) {
      fetchCategorias()
      // Reset form values on open if necessary, or just clear valor
      setDisplayValor('')
      setFormData(prev => ({ ...prev, valor: '', descricao: '', categoria_id: '', subcategoria_id: '' }))
    }
  }, [isOpen, usuarioId, fetchCategorias])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'categoria_id') {
        next.subcategoria_id = '' // reset subcat on cat change
      }
      return next
    })
  }

  const handleTypeChange = (newType) => {
    if (formData.tipo !== newType) {
      setFormData(prev => ({
        ...prev,
        tipo: newType,
        categoria_id: '',
        subcategoria_id: ''
      }))
    }
  }

  const handleCurrencyChange = (e) => {
    let userInput = e.target.value.replace(/\D/g, "")
    if (userInput === "") userInput = "0"
    
    const numValue = (parseInt(userInput, 10) / 100).toFixed(2)
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue)
    
    setDisplayValor(formatted)
    setFormData(prev => ({ ...prev, valor: numValue }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      alert("Informe um valor válido maior que zero.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/transacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': usuarioId
        },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        onSave()
        onClose()
      } else {
        const error = await res.json()
        alert(error.message || 'Erro ao salvar transação')
      }
    } catch (err) {
      console.error(err)
      alert('Erro inesperado de conexão')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedCategoria = categorias.find(c => c.id === formData.categoria_id)
  const subcategorias = selectedCategoria ? selectedCategoria.subcategorias : []

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Nova Transação</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Tipo</label>
            <div className="type-toggle">
              <button 
                type="button"
                className={`type-btn despesa ${formData.tipo === 'DESPESA' ? 'active' : ''}`}
                onClick={() => handleTypeChange('DESPESA')}
              >
                Despesa
              </button>
              <button 
                type="button"
                className={`type-btn receita ${formData.tipo === 'RECEITA' ? 'active' : ''}`}
                onClick={() => handleTypeChange('RECEITA')}
              >
                Receita
              </button>
            </div>
          </div>

          <div className="form-group" style={{ opacity: loadingCats ? 0.5 : 1 }}>
            <label>Categoria</label>
            <CustomSelect 
              name="categoria_id" 
              value={formData.categoria_id} 
              onChange={handleChange} 
              options={categorias.filter(c => c.tipo === formData.tipo)} 
              placeholder="Selecione..." 
            />
          </div>

          {subcategorias.length > 0 && (
            <div className="form-group slide-down">
              <label>Subcategoria</label>
              <CustomSelect 
                name="subcategoria_id" 
                value={formData.subcategoria_id} 
                onChange={handleChange} 
                options={subcategorias} 
                placeholder="Selecione..." 
              />
            </div>
          )}

          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Descrição</label>
            <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} required placeholder="Ex: Mercado" />
          </div>

          <div className="form-group">
            <label>Valor (R$)</label>
            <input 
              type="text" 
              name="valorDisplay" 
              value={displayValor} 
              onChange={handleCurrencyChange} 
              required 
              placeholder="0,00" 
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label>Data</label>
            <input type="date" name="data_transacao" value={formData.data_transacao} onChange={handleChange} required />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Transação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
