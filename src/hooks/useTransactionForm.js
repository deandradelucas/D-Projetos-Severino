import { useState, useCallback } from 'react'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { showToast } from '../lib/toastStore'
import { transacaoDescricaoEfetiva } from '../lib/transacaoUtils'

function localDateTimeNow() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now - offset).toISOString().slice(0, 16)
}

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
  cartao_id: '',
  status: 'EFETIVADA',
  recorrencia_dia_1: false,
  parcelado: false,
  num_parcelas: '2',
  parcela_inicial: '1',
  data_pagamento: '',
  prazo_indeterminado: false,
}

export function useTransactionForm({ usuarioId, editingTransaction, isOpen, onSave, onClose }) {
  const isEditMode = Boolean(editingTransaction?.id)

  const [formData, setFormData] = useState(INITIAL_FORM)
  const [displayValor, setDisplayValor] = useState('')
  const [saving, setSaving] = useState(false)

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
        descricao: transacaoDescricaoEfetiva(t),
        valor: String(numValue),
        tipo: t.tipo || 'DESPESA',
        data_transacao: dtStr,
        categoria_id: t.categoria_id != null ? String(t.categoria_id) : '',
        subcategoria_id: t.subcategoria_id != null ? String(t.subcategoria_id) : '',
        cartao_id: t.cartao_id != null ? String(t.cartao_id) : '',
        status: t.status || 'EFETIVADA',
        recorrencia_dia_1: false,
        parcelado: false,
        num_parcelas: '2',
        parcela_inicial: '1',
        data_pagamento: '',
        prazo_indeterminado: false,
        recorrente_index: t.recorrente_index != null ? String(t.recorrente_index) : '',
        recorrente_total: t.recorrente_total != null ? String(t.recorrente_total) : '',
      })
      return
    }

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
      const next = { ...prev, tipo: newType, categoria_id: '', subcategoria_id: '' }
      // Parcelamento e vínculo de cartão só existem em despesa. Ao virar receita,
      // zera o estado residual para não vazar parcelamento no payload do submit.
      if (newType === 'RECEITA') {
        next.parcelado = false
        next.cartao_id = ''
        next.num_parcelas = '2'
        next.parcela_inicial = '1'
        next.prazo_indeterminado = false
      }
      return next
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

  // Retorna true quando a transação foi salva com sucesso (false em validação/erro).
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      showToast('Informe um valor válido maior que zero.', 'error')
      return false
    }

    const numParcelas = parseInt(formData.num_parcelas, 10)
    if (
      formData.parcelado &&
      !formData.prazo_indeterminado &&
      (!Number.isInteger(numParcelas) || numParcelas < 2 || numParcelas > 120)
    ) {
      showToast('Número de parcelas deve ser entre 2 e 120.', 'error')
      return false
    }
    const parcelaInicial = parseInt(formData.parcela_inicial, 10) || 1
    if (
      formData.parcelado &&
      !formData.prazo_indeterminado &&
      (parcelaInicial < 1 || parcelaInicial >= numParcelas)
    ) {
      showToast(`Parcela inicial deve ser entre 1 e ${numParcelas - 1}.`, 'error')
      return false
    }

    // Edição de parcelada: o input tem min/max, mas type=number não impede digitar
    // fora da faixa — valida aqui antes de montar o payload.
    if (isEditMode && formData.recorrente_total) {
      const rt = parseInt(formData.recorrente_total, 10)
      const ri = parseInt(formData.recorrente_index, 10)
      if (rt > 0 && (!Number.isInteger(ri) || ri < 1 || ri > rt)) {
        showToast(`Parcela deve ser entre 1 e ${rt}.`, 'error')
        return false
      }
    }

    const descricao = String(formData.descricao || '').trim()

    setSaving(true)
    try {
      const payload = {
        ...formData,
        data_transacao: new Date(formData.data_transacao).toISOString(),
        descricao,
      }

      // Limpa campos de controle de UI
      delete payload.parcelado
      delete payload.num_parcelas
      delete payload.parcela_inicial
      delete payload.data_pagamento
      delete payload.prazo_indeterminado

      if (isEditMode) {
        // Em edição: recorrente_index pode ser alterado pelo usuário.
        // Reconstrói a descrição com o novo sufixo (N/total) se for parcelada.
        const ri = parseInt(formData.recorrente_index, 10)
        const rt = parseInt(formData.recorrente_total, 10)
        if (ri > 0 && rt > 0) {
          payload.recorrente_index = ri
          payload.descricao = descricao ? `${descricao} (${ri}/${rt})` : `Parcela ${ri}/${rt}`
        } else {
          // Transação não parcelada: o spread do formData traz recorrente_index: ''
          // — não pode ir ao backend (risco de zerar o campo no registro).
          delete payload.recorrente_index
        }
        delete payload.recorrente_total
      }

      if (!isEditMode) {
        payload.recorrencia = null

        // Data de pagamento (opcional): aplicada como data-base do lançamento.
        // Input <type="date"> entrega "YYYY-MM-DD"; convertemos para ISO em UTC noon
        // pra evitar deslize de fuso (fica no mesmo dia em qualquer timezone).
        const dpRaw = String(formData.data_pagamento || '').trim()
        let dpIso = null
        if (dpRaw) {
          const dp = new Date(`${dpRaw}T12:00:00Z`)
          if (!Number.isNaN(dp.getTime())) dpIso = dp.toISOString()
        }

        if (formData.parcelado && formData.prazo_indeterminado) {
          // Assinatura/stream sem fim: não cria N parcelas, ativa recorrência
          // mensal indeterminada (mesmo modelo de "Repetir todo mês neste dia").
          payload.recorrencia_dia_1 = true
          if (dpIso) payload.data_transacao = dpIso
          delete payload.parcelamento
        } else if (formData.parcelado && numParcelas >= 2) {
          const parcelamento = { num_parcelas: numParcelas }
          if (dpIso) parcelamento.data_pagamento = dpIso
          if (parcelaInicial > 1) parcelamento.parcela_inicial = parcelaInicial
          payload.parcelamento = parcelamento
          delete payload.recorrencia_dia_1
        } else if (!formData.recorrencia_dia_1) {
          delete payload.recorrencia_dia_1
        }
      } else {
        delete payload.recorrencia_dia_1
      }

      const url = isEditMode
        ? apiUrl(`/api/transacoes/${editingTransaction.id}`)
        : apiUrl('/api/transacoes')
      const method = isEditMode ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        showToast(json.message || (isEditMode ? 'Alterações salvas!' : 'Transação registrada!'))
        onSave()
        onClose()
        return true
      }
      const error = await res.json().catch(() => ({}))
      showToast(error.message || 'Não foi possível salvar a transação.', 'error')
      return false
    } catch {
      showToast('Sem conexão. Tente de novo.', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }, [formData, isEditMode, editingTransaction, onSave, onClose])

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
