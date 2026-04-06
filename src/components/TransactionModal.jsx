import React, { useState, useEffect } from 'react'

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

  const handleSubmit = async (e) => {
    e.preventDefault()
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
            <select name="tipo" value={formData.tipo} onChange={handleChange} required>
              <option value="DESPESA">Despesa</option>
              <option value="RECEITA">Receita</option>
            </select>
          </div>

          <div className="form-group">
            <label>Descrição</label>
            <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} required placeholder="Ex: Mercado" />
          </div>

          <div className="form-group">
            <label>Valor (R$)</label>
            <input type="number" step="0.01" name="valor" value={formData.valor} onChange={handleChange} required placeholder="0.00" />
          </div>

          <div className="form-group">
            <label>Data</label>
            <input type="date" name="data_transacao" value={formData.data_transacao} onChange={handleChange} required />
          </div>

          <div className="form-group" style={{ opacity: loadingCats ? 0.5 : 1 }}>
            <label>Categoria</label>
            <select name="categoria_id" value={formData.categoria_id} onChange={handleChange}>
              <option value="">Selecione...</option>
              {categorias.filter(c => c.tipo === formData.tipo).map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {subcategorias.length > 0 && (
            <div className="form-group">
              <label>Subcategoria</label>
              <select name="subcategoria_id" value={formData.subcategoria_id} onChange={handleChange}>
                <option value="">Selecione...</option>
                {subcategorias.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Cobrindo...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
