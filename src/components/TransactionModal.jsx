import React, { useState, useEffect, useRef } from 'react'

const CustomSelect = ({ name, value, onChange, options, placeholder, isOpen, onToggle, zIndex = 1 }) => {
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        if (isOpen) {
          onToggle(null)
          setSearch('')
        }
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onToggle])

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filteredOptions = options.filter(o => 
    o.nome.toLowerCase().includes(search.toLowerCase())
  )

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && search && filteredOptions.length > 0) {
      e.preventDefault();
      onChange({ target: { name, value: filteredOptions[0].id } });
      onToggle(null);
      setSearch('');
    } else if (e.key === 'Escape') {
      onToggle(null);
      setSearch('');
    }
  }

  const selected = options.find(o => String(o.id) === String(value))

  return (
    <div className={`custom-select ${isOpen ? 'open' : ''}`} ref={ref} style={{ zIndex }}>
      <input type="text" name={name} value={value} readOnly required className="sr-only" style={{ opacity: 0, position: 'absolute', zIndex: -1, width: '100%', height: '100%', bottom: 0, left: 0 }} />
      <div className="custom-select-trigger" onClick={() => onToggle(isOpen ? null : name)}>
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
        <div className="custom-select-search">
          <input 
            type="text" 
            placeholder="Procurar..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            onKeyDown={handleKeyDown}
            ref={searchInputRef}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="custom-select-options">
          {filteredOptions.length === 0 && (
            <div className="custom-select-no-results">Nenhum resultado</div>
          )}
          {filteredOptions.map(opt => (
            <div 
              key={opt.id} 
              className={`custom-select-option ${String(value) === String(opt.id) ? 'selected' : ''}`}
              onClick={() => { 
                onChange({ target: { name, value: opt.id } }); 
                onToggle(null);
                setSearch('');
              }}
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
  const [activeSelect, setActiveSelect] = useState(null)

  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    tipo: 'DESPESA',
    data_transacao: new Date().toISOString().split('T')[0],
    categoria_id: '',
    subcategoria_id: ''
  })
  
  const [displayValor, setDisplayValor] = useState('')
  const valorInputRef = useRef(null)

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
      setDisplayValor('')
      setFormData(prev => ({ 
        ...prev, 
        valor: '', 
        descricao: '', 
        categoria_id: '', 
        subcategoria_id: '',
        data_transacao: new Date().toISOString().split('T')[0]
      }))
      
      // Auto focus valor field
      setTimeout(() => {
        if (valorInputRef.current) valorInputRef.current.focus()
      }, 100)
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Valor (R$)</label>
              <input 
                type="text" 
                name="valorDisplay" 
                value={displayValor} 
                onChange={handleCurrencyChange} 
                ref={valorInputRef}
                required 
                placeholder="0,00" 
                autoComplete="off"
                className="input-premium"
              />
            </div>

            <div className="form-group">
              <label>Data</label>
              <input type="date" name="data_transacao" value={formData.data_transacao} onChange={handleChange} required className="input-premium" />
            </div>
          </div>

          <div className="form-group">
            <label>Descrição</label>
            <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} required placeholder="O que você comprou?" className="input-premium" />
          </div>

          <div className="form-group" style={{ opacity: loadingCats ? 0.5 : 1 }}>
            <label>Categoria</label>
            <CustomSelect 
              name="categoria_id" 
              value={formData.categoria_id} 
              onChange={handleChange} 
              options={categorias.filter(c => c.tipo === formData.tipo)} 
              placeholder="Pesquise..." 
              isOpen={activeSelect === 'categoria_id'}
              onToggle={setActiveSelect}
              zIndex={10}
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
                placeholder="Pesquise..." 
                isOpen={activeSelect === 'subcategoria_id'}
                onToggle={setActiveSelect}
                zIndex={5}
              />
            </div>
          )}

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
