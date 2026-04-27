import { useState, useCallback } from 'react'
import { apiUrl } from '../lib/apiUrl'
import { showToast } from '../lib/toastStore'

/**
 * Retorna o datetime local (sem UTC shift) no formato ISO slice(0,16).
 */
function localDateTimeNow() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now - offset).toISOString().slice(0, 16)
}

/**
 * Formata número como moeda BRL.
 */
function formatBRL(numValue) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue)
}

const INITIAL_FORM = {
  descricao: '',
  valor: '',
  tipo: 'DESPESA',
  data_transacao: localDateTimeNow(),
  categoria_id: '',
  subcategoria_id: '',
  status: 'EFETIVADA',
  recorrencia_dia_1: false,
}

/**
 * Hook centralizado para o estado e lógica do formulário de transação.
 */
export function useTransactionForm({ usuarioId, editingTransaction, isOpen, categorias, onSave, onClose }) {
  const isEditMode = Boolean(editingTransaction?.id)

  const [formData, setFormData] = useState(INITIAL_FORM)
  const [displayValor, setDisplayValor] = useState('')
  const [saving, setSaving] = useState(false)

  /**
   * Inicializa formulário ao abrir/trocar de modo.
   */
  const initForm = useCallback(() => {
    if (!isOpen || !usuarioId) return

    if (editingTransaction?.id) {
      const t = editingTransaction
      const val = parseFloat(t.valor) || 0
      const numValue = Number(val.toFixed(2))
      setDisplayValor(formatBRL(numValue))

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

    // Modo criação
    setDisplayValor('')
    setFormData({ ...INITIAL_FORM, data_transacao: localDateTimeNow() })
  }, [isOpen, usuarioId, editingTransaction])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'categoria_id') next.subcategoria_id = ''
      return next
    })
  }, [])

  const handleTypeChange = useCallback((newType) => {
    setFormData((prev) => {
      if (prev.tipo === newType) return prev
      return { ...prev, tipo: newType, categoria_id: '', subcategoria_id: '' }
    })
  }, [])

  const handleCurrencyChange = useCallback((e) => {
    let userInput = e.target.value.replace(/\D/g, '')
    if (userInput === '') userInput = '0'
    const numValue = (parseInt(userInput, 10) / 100).toFixed(2)
    setDisplayValor(formatBRL(numValue))
    setFormData((prev) => ({ ...prev, valor: numValue }))
  }, [])

  const setDateShortcut = useCallback((daysAgo = 0) => {
    const d = new Date()
    if (daysAgo > 0) d.setDate(d.getDate() - daysAgo)
    const offset = d.getTimezoneOffset() * 60000
    const dStr = new Date(d - offset).toISOString().slice(0, 16)
    setFormData((prev) => ({ ...prev, data_transacao: dStr }))
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      alert('Informe um valor válido maior que zero.')
      return
    }

    // Auto-preenche descrição pela categoria se vazio
    let finalDescricao = formData.descricao
    if (!finalDescricao) {
      const cat = categorias.find((c) => c.id === formData.categoria_id)
      const sub = cat?.subcategorias?.find((s) => s.id === formData.subcategoria_id)
      finalDescricao = sub?.nome || cat?.nome || ''
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
        headers: { 'Content-Type': 'application/json', 'x-user-id': usuarioId },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        showToast(isEditMode ? 'Alterações salvas!' : 'Transação registrada!')
        onSave()
        onClose()
      } else {
        const error = await res.json()
        alert(error.message || 'Erro ao salvar transação')
      }
    } catch {
      alert('Erro inesperado de conexão')
    } finally {
      setSaving(false)
    }
  }, [formData, categorias, isEditMode, editingTransaction, usuarioId, onSave, onClose])

  return {
    formData,
    setFormData,
    displayValor,
    saving,
    isEditMode,
    initForm,
    handleChange,
    handleTypeChange,
    handleCurrencyChange,
    setDateShortcut,
    handleSubmit,
  }
}
