import React, { useState, useEffect, useRef } from 'react'
import { apiUrl } from '../lib/apiUrl'

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

export default function TransactionModal({ isOpen, onClose, onSave, usuarioId, editingTransaction = null }) {
  const [categorias, setCategorias] = useState([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeSelect, setActiveSelect] = useState(null)

  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    tipo: 'DESPESA',
    data_transacao: (() => {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      return new Date(now - offset).toISOString().slice(0, 16);
    })(),
    categoria_id: '',
    subcategoria_id: '',
    status: 'EFETIVADA',
    recorrencia_dia_1: false,
  })
  
  const [displayValor, setDisplayValor] = useState('')
  const valorInputRef = useRef(null)

  const fetchCategorias = React.useCallback(async () => {
    setLoadingCats(true)
    try {
      const res = await fetch(apiUrl('/api/categorias'), {
        headers: { 'x-user-id': usuarioId },
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

  const isEditMode = Boolean(editingTransaction?.id)

  useEffect(() => {
    if (!isOpen || !usuarioId) return

    fetchCategorias()

    if (editingTransaction?.id) {
      const t = editingTransaction
      const val = parseFloat(t.valor) || 0
      const numValue = Number(val.toFixed(2))
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(numValue)
      setDisplayValor(formatted)

      let dtStr = ''
      if (t.data_transacao) {
        const d = new Date(t.data_transacao)
        if (!Number.isNaN(d.getTime())) {
          const offset = d.getTimezoneOffset() * 60000
          dtStr = new Date(d.getTime() - offset).toISOString().slice(0, 16)
        }
      }

      setFormData({
        descricao: t.descricao || '',
        valor: String(numValue),
        tipo: t.tipo || 'DESPESA',
        data_transacao: dtStr,
        categoria_id: t.categoria_id != null ? String(t.categoria_id) : '',
        subcategoria_id: t.subcategoria_id != null ? String(t.subcategoria_id) : '',
        status: t.status || 'EFETIVADA',
        recorrencia_dia_1: false,
      })
      return
    }

    setDisplayValor('')
    setFormData((prev) => ({
      ...prev,
      valor: '',
      descricao: '',
      categoria_id: '',
      subcategoria_id: '',
      status: 'EFETIVADA',
      recorrencia_dia_1: false,
      data_transacao: (() => {
        const now = new Date()
        const offset = now.getTimezoneOffset() * 60000
        return new Date(now - offset).toISOString().slice(0, 16)
      })(),
    }))

    setTimeout(() => {
      if (valorInputRef.current) valorInputRef.current.focus()
    }, 100)
  }, [isOpen, usuarioId, editingTransaction?.id, fetchCategorias])

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

    let finalDescricao = formData.descricao;
    if (!finalDescricao) {
      const cat = categorias.find(c => c.id === formData.categoria_id);
      const sub = cat?.subcategorias?.find(s => s.id === formData.subcategoria_id);
      finalDescricao = sub?.nome || cat?.nome || '';
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        data_transacao: new Date(formData.data_transacao).toISOString(),
        descricao: finalDescricao,
      }
      if (!isEditMode) {
        payload.recorrencia = null
      } else {
        delete payload.recorrencia_dia_1
      }
      if (!isEditMode && !formData.recorrencia_dia_1) {
        delete payload.recorrencia_dia_1
      }

      const url = isEditMode
        ? apiUrl(`/api/transacoes/${editingTransaction.id}`)
        : apiUrl('/api/transacoes')
      const method = isEditMode ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': usuarioId,
        },
        body: JSON.stringify(payload),
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
          <h3>{isEditMode ? 'Editar Transação' : 'Nova Transação'}</h3>
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

          <div className="form-group">
            <label>
              Descrição{' '}
              <span style={{ fontSize: '11px', opacity: 0.7, fontWeight: 400, textTransform: 'lowercase' }}>(opcional)</span>
            </label>
            <input
              type="text"
              name="descricao"
              value={formData.descricao}
              onChange={handleChange}
              placeholder="O que você comprou?"
              className="input-premium"
            />
          </div>

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
            <div className="modal-date-toolbar">
              <label htmlFor="tx-data-transacao">Data</label>
              <div className="date-shortcuts">
                <button
                  type="button"
                  className="date-shortcut-btn"
                  onClick={() => {
                    const now = new Date()
                    const offset = now.getTimezoneOffset() * 60000
                    const dStr = new Date(now - offset).toISOString().slice(0, 16)
                    setFormData(prev => ({ ...prev, data_transacao: dStr }))
                  }}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className="date-shortcut-btn"
                  onClick={() => {
                    const yesterday = new Date()
                    yesterday.setDate(yesterday.getDate() - 1)
                    const offset = yesterday.getTimezoneOffset() * 60000
                    const yStr = new Date(yesterday - offset).toISOString().slice(0, 16)
                    setFormData(prev => ({ ...prev, data_transacao: yStr }))
                  }}
                >
                  Ontem
                </button>
              </div>
            </div>
            <input
              id="tx-data-transacao"
              type="datetime-local"
              name="data_transacao"
              value={formData.data_transacao}
              onChange={handleChange}
              required
              className="input-premium"
            />
          </div>

          {!isEditMode && (
            <div
              className={`modal-recorrencia-panel ${formData.recorrencia_dia_1 ? 'modal-recorrencia-panel--active' : ''}`}
            >
              <label className="modal-recorrencia-panel__label" htmlFor="tx-recorrencia-dia-1">
                <span
                  className={`modal-recorrencia-panel__icon ${formData.recorrencia_dia_1 ? 'modal-recorrencia-panel__icon--on' : ''}`}
                  aria-hidden
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </span>
                <span className="modal-recorrencia-panel__copy">
                  <span className="modal-recorrencia-panel__title">Repetir todo dia 1</span>
                  <span className="modal-recorrencia-panel__hint">
                    No primeiro dia de cada mês o sistema lança esta mesma conta ou receita automaticamente (fuso
                    Brasil).
                  </span>
                </span>
                <input
                  id="tx-recorrencia-dia-1"
                  type="checkbox"
                  name="recorrencia_dia_1"
                  checked={formData.recorrencia_dia_1}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, recorrencia_dia_1: e.target.checked }))
                  }
                  className="modal-recorrencia-panel__checkbox"
                />
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
            <button type="submit" className={`btn-primary ${saving ? 'loading' : ''}`} disabled={saving}>
              {saving ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <svg className="spinner" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                  Salvando...
                </div>
              ) : isEditMode ? 'Salvar alterações' : 'Salvar Transação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
