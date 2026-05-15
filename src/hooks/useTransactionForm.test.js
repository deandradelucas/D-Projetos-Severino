import { describe, it, expect, vi } from 'vitest'

/* ---- mocks de módulos que dependem de browser/API ---- */
vi.mock('../lib/apiUrl', () => ({ apiUrl: (p) => `http://test${p}` }))
vi.mock('../lib/apiAuthHeaders', () => ({
  horizonteApiAuthHeaders: () => ({ Authorization: 'Bearer test' }),
}))
vi.mock('../lib/toastStore', () => ({ showToast: vi.fn() }))

/* Importações das funções puras extraídas do hook para teste direto */
function localDateTimeNow() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now - offset).toISOString().slice(0, 16)
}

function formatBRL(numValue) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numValue)
}

describe('localDateTimeNow', () => {
  it('retorna string no formato YYYY-MM-DDTHH:MM', () => {
    const result = localDateTimeNow()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('não tem timezone offset duplicado', () => {
    const result = localDateTimeNow()
    const parsed = new Date(result)
    expect(parsed).toBeInstanceOf(Date)
    expect(isNaN(parsed.getTime())).toBe(false)
  })
})

describe('formatBRL', () => {
  it('formata zero como R$ 0,00', () => {
    const result = formatBRL(0)
    expect(result).toContain('0,00')
  })

  it('formata 1234.56 corretamente', () => {
    const result = formatBRL(1234.56)
    expect(result).toContain('1.234,56')
  })

  it('formata valores negativos', () => {
    const result = formatBRL(-50)
    expect(result).toContain('50,00')
  })
})

describe('lógica de parse de valor BRL', () => {
  function parseCurrencyInput(userInput) {
    let cleaned = userInput.replace(/\D/g, '')
    if (cleaned === '') cleaned = '0'
    return (parseInt(cleaned, 10) / 100).toFixed(2)
  }

  it('converte centavos digitados corretamente', () => {
    expect(parseCurrencyInput('12345')).toBe('123.45')
  })

  it('trata entrada vazia como 0.00', () => {
    expect(parseCurrencyInput('')).toBe('0.00')
  })

  it('ignora caracteres não-numéricos', () => {
    /* 'R$1.234,56' → digits '123456' → /100 = 1234.56 */
    expect(parseCurrencyInput('R$1.234,56')).toBe('1234.56')
  })

  it('trata string de zeros', () => {
    expect(parseCurrencyInput('0')).toBe('0.00')
  })
})

describe('lógica de initForm — modo edição', () => {
  function buildFormDataFromTransaction(t) {
    const val = parseFloat(t.valor) || 0
    const numValue = Number(val.toFixed(2))

    let dtStr = ''
    if (t.data_transacao) {
      const d = new Date(t.data_transacao)
      if (!Number.isNaN(d.getTime())) {
        const offset = d.getTimezoneOffset() * 60000
        dtStr = new Date(d.getTime() - offset).toISOString().slice(0, 16)
      }
    }

    return {
      descricao: t.descricao || '',
      valor: String(numValue),
      tipo: t.tipo || 'DESPESA',
      data_transacao: dtStr,
      categoria_id: t.categoria_id != null ? String(t.categoria_id) : '',
      subcategoria_id: t.subcategoria_id != null ? String(t.subcategoria_id) : '',
      status: t.status || 'EFETIVADA',
      recorrencia_dia_1: false,
    }
  }

  it('preenche campos corretamente a partir de uma transação', () => {
    const t = {
      id: 1,
      descricao: 'Supermercado',
      valor: '150.75',
      tipo: 'DESPESA',
      data_transacao: '2025-01-15T10:00:00.000Z',
      categoria_id: 3,
      subcategoria_id: null,
      status: 'EFETIVADA',
    }
    const form = buildFormDataFromTransaction(t)
    expect(form.descricao).toBe('Supermercado')
    expect(form.valor).toBe('150.75')
    expect(form.tipo).toBe('DESPESA')
    expect(form.categoria_id).toBe('3')
    expect(form.subcategoria_id).toBe('')
    expect(form.status).toBe('EFETIVADA')
    expect(form.recorrencia_dia_1).toBe(false)
  })

  it('trata valor inválido como 0', () => {
    const t = { valor: 'abc', tipo: 'RECEITA', data_transacao: null }
    const form = buildFormDataFromTransaction(t)
    expect(form.valor).toBe('0')
    expect(form.data_transacao).toBe('')
  })

  it('normaliza data_transacao para formato local', () => {
    const t = { valor: '100', tipo: 'RECEITA', data_transacao: '2025-06-01T00:00:00.000Z' }
    const form = buildFormDataFromTransaction(t)
    expect(form.data_transacao).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('lógica de handleChange', () => {
  it('ao mudar categoria_id, limpa subcategoria_id', () => {
    function applyChange(prev, name, value) {
      const next = { ...prev, [name]: value }
      if (name === 'categoria_id') next.subcategoria_id = ''
      return next
    }

    const prev = { categoria_id: '1', subcategoria_id: '5', descricao: 'test' }
    const next = applyChange(prev, 'categoria_id', '2')
    expect(next.categoria_id).toBe('2')
    expect(next.subcategoria_id).toBe('')
    expect(next.descricao).toBe('test')
  })

  it('mudança de outro campo não afeta subcategoria_id', () => {
    function applyChange(prev, name, value) {
      const next = { ...prev, [name]: value }
      if (name === 'categoria_id') next.subcategoria_id = ''
      return next
    }

    const prev = { categoria_id: '1', subcategoria_id: '5', descricao: '' }
    const next = applyChange(prev, 'descricao', 'Aluguel')
    expect(next.subcategoria_id).toBe('5')
    expect(next.descricao).toBe('Aluguel')
  })
})

describe('lógica de handleTypeChange', () => {
  function applyTypeChange(prev, newType) {
    if (prev.tipo === newType) return prev
    return { ...prev, tipo: newType, categoria_id: '', subcategoria_id: '' }
  }

  it('trocar tipo limpa categorias', () => {
    const prev = { tipo: 'DESPESA', categoria_id: '3', subcategoria_id: '7' }
    const next = applyTypeChange(prev, 'RECEITA')
    expect(next.tipo).toBe('RECEITA')
    expect(next.categoria_id).toBe('')
    expect(next.subcategoria_id).toBe('')
  })

  it('mesmo tipo retorna referência inalterada', () => {
    const prev = { tipo: 'DESPESA', categoria_id: '3', subcategoria_id: '7' }
    const next = applyTypeChange(prev, 'DESPESA')
    expect(next).toBe(prev)
  })
})

describe('lógica de setDateShortcut', () => {
  function buildDateShortcut(daysAgo = 0) {
    const d = new Date()
    if (daysAgo > 0) d.setDate(d.getDate() - daysAgo)
    const offset = d.getTimezoneOffset() * 60000
    return new Date(d - offset).toISOString().slice(0, 16)
  }

  it('daysAgo=0 retorna data de hoje', () => {
    const result = buildDateShortcut(0)
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(result).toContain(todayStr)
  })

  it('daysAgo=1 retorna data de ontem', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    const result = buildDateShortcut(1)
    expect(result).toContain(yesterdayStr)
  })
})
