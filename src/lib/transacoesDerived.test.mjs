import { describe, it, expect } from 'vitest'
import {
  construirGruposParcelados,
  filtrarGruposParcelados,
  segmentarGrupos,
  calcularTotaisParcelados,
  filtrarTransacoesVisiveis,
  agruparTransacoesPorDia,
  calcularQuickTotals,
} from './transacoesDerived.js'

// Helpers de data relativos a "hoje" para os filtros temporais
function isoDiasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const HOJE = isoDiasAtras(0)
const ymAtual = HOJE.slice(0, 7)

describe('filtrarTransacoesVisiveis', () => {
  const base = [
    { id: 1, descricao: 'Mercado Extra', valor: 100, tipo: 'DESPESA', status: 'EFETIVADA', data_transacao: `${HOJE}T10:00`, categorias: { nome: 'Alimentação' } },
    { id: 2, descricao: 'Salário', valor: 5000, tipo: 'RECEITA', status: 'EFETIVADA', data_transacao: `${isoDiasAtras(3)}T08:00` },
    { id: 3, descricao: 'Conta de luz', valor: 200, tipo: 'DESPESA', status: 'PENDENTE', data_transacao: `${isoDiasAtras(40)}T08:00` },
  ]

  it('sem filtros retorna tudo', () => {
    expect(filtrarTransacoesVisiveis(base, '', null)).toHaveLength(3)
  })

  it('busca por descrição (case-insensitive)', () => {
    const r = filtrarTransacoesVisiveis(base, 'salário', null)
    expect(r.map((t) => t.id)).toEqual([2])
  })

  it('busca por categoria', () => {
    const r = filtrarTransacoesVisiveis(base, 'aliment', null)
    expect(r.map((t) => t.id)).toEqual([1])
  })

  it('filtro receitas/despesas', () => {
    expect(filtrarTransacoesVisiveis(base, '', 'receitas').map((t) => t.id)).toEqual([2])
    expect(filtrarTransacoesVisiveis(base, '', 'despesas').map((t) => t.id)).toEqual([1, 3])
  })

  it('filtro pendentes', () => {
    expect(filtrarTransacoesVisiveis(base, '', 'pendentes').map((t) => t.id)).toEqual([3])
  })

  it('filtro hoje', () => {
    expect(filtrarTransacoesVisiveis(base, '', 'hoje').map((t) => t.id)).toEqual([1])
  })

  it('filtro 7d inclui hoje e 3 dias atrás, exclui 40 dias', () => {
    expect(filtrarTransacoesVisiveis(base, '', '7d').map((t) => t.id).sort()).toEqual([1, 2])
  })
})

describe('calcularQuickTotals', () => {
  it('soma entradas/saídas ignorando pendentes', () => {
    const txs = [
      { tipo: 'RECEITA', valor: 1000, status: 'EFETIVADA' },
      { tipo: 'DESPESA', valor: 300, status: 'EFETIVADA' },
      { tipo: 'DESPESA', valor: 999, status: 'PENDENTE' }, // ignorada
    ]
    expect(calcularQuickTotals(txs)).toEqual({ entradas: 1000, saidas: 300, saldo: 700, count: 3 })
  })

  it('lista vazia', () => {
    expect(calcularQuickTotals([])).toEqual({ entradas: 0, saidas: 0, saldo: 0, count: 0 })
  })
})

describe('agruparTransacoesPorDia', () => {
  it('agrupa por dia, rotula Hoje e soma totais (sem pendentes)', () => {
    const txs = [
      { id: 1, tipo: 'RECEITA', valor: 100, status: 'EFETIVADA', data_transacao: `${HOJE}T10:00` },
      { id: 2, tipo: 'DESPESA', valor: 40, status: 'EFETIVADA', data_transacao: `${HOJE}T12:00` },
      { id: 3, tipo: 'DESPESA', valor: 999, status: 'PENDENTE', data_transacao: `${HOJE}T13:00` },
    ]
    const grupos = agruparTransacoesPorDia(txs)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].label).toBe('Hoje')
    expect(grupos[0].txs).toHaveLength(3)
    expect(grupos[0].totalReceitas).toBe(100)
    expect(grupos[0].totalDespesas).toBe(40)
  })

  it('ordena grupos por data desc', () => {
    const txs = [
      { id: 1, tipo: 'DESPESA', valor: 10, status: 'EFETIVADA', data_transacao: `${isoDiasAtras(5)}T10:00` },
      { id: 2, tipo: 'DESPESA', valor: 10, status: 'EFETIVADA', data_transacao: `${HOJE}T10:00` },
    ]
    const grupos = agruparTransacoesPorDia(txs)
    expect(grupos[0].label).toBe('Hoje')
  })
})

describe('construirGruposParcelados', () => {
  it('agrupa parcelado e calcula progresso/status', () => {
    const txs = [
      { id: 1, descricao: 'TV (1/3)', valor: 100, tipo: 'DESPESA', status: 'EFETIVADA', recorrente_grupo_id: 'g1', recorrente_index: 1, recorrente_total: 3, data_transacao: isoDiasAtras(60) },
      { id: 2, descricao: 'TV (2/3)', valor: 100, tipo: 'DESPESA', status: 'EFETIVADA', recorrente_grupo_id: 'g1', recorrente_index: 2, recorrente_total: 3, data_transacao: isoDiasAtras(30) },
      { id: 3, descricao: 'TV (3/3)', valor: 100, tipo: 'DESPESA', status: 'PENDENTE', recorrente_grupo_id: 'g1', recorrente_index: 3, recorrente_total: 3, data_transacao: isoDiasAtras(-5) },
    ]
    const grupos = construirGruposParcelados(txs)
    expect(grupos).toHaveLength(1)
    const g = grupos[0]
    expect(g.kind).toBe('parcelado')
    expect(g.descricao_base).toBe('TV')
    expect(g.parcelas_pagas).toBe(2)
    expect(g.parcelas_total).toBe(3)
    expect(g.parcelas_pct).toBe(67)
    expect(g.valor_pago).toBe(200)
    expect(g.valor_restante).toBe(100)
    expect(g.status).toBe('em-dia')
    expect(g.proxima_parcela?.id).toBe(3)
  })

  it('marca atrasada quando há parcela pendente no passado', () => {
    const txs = [
      { id: 1, descricao: 'Curso (1/2)', valor: 50, tipo: 'DESPESA', status: 'PENDENTE', recorrente_grupo_id: 'g2', recorrente_index: 1, recorrente_total: 2, data_transacao: isoDiasAtras(10) },
      { id: 2, descricao: 'Curso (2/2)', valor: 50, tipo: 'DESPESA', status: 'PENDENTE', recorrente_grupo_id: 'g2', recorrente_index: 2, recorrente_total: 2, data_transacao: isoDiasAtras(-20) },
    ]
    const g = construirGruposParcelados(txs)[0]
    expect(g.status).toBe('atrasada')
  })

  it('agrupa mensal (recorrencia_mensal_id)', () => {
    const txs = [
      { id: 1, descricao: 'Netflix', valor: 40, tipo: 'DESPESA', status: 'EFETIVADA', recorrencia_mensal_id: 'm1', data_transacao: isoDiasAtras(30) },
      { id: 2, descricao: 'Netflix', valor: 40, tipo: 'DESPESA', status: 'EFETIVADA', recorrencia_mensal_id: 'm1', data_transacao: isoDiasAtras(0) },
    ]
    const g = construirGruposParcelados(txs)[0]
    expect(g.kind).toBe('mensal')
    expect(g.parcelas_total).toBe(2)
  })

  it('ignora transações simples', () => {
    const txs = [{ id: 1, descricao: 'Café', valor: 5, tipo: 'DESPESA', status: 'EFETIVADA', data_transacao: isoDiasAtras(1) }]
    expect(construirGruposParcelados(txs)).toEqual([])
  })
})

describe('filtrarGruposParcelados', () => {
  const grupos = [
    { id: 'a', kind: 'parcelado', descricao_base: 'Geladeira', status: 'em-dia', valor_total: 300, parcelas_total: 3, parcelas_pct: 33, data_inicio: isoDiasAtras(60), proxima_parcela: null, categorias: null, subcategorias: null },
    { id: 'b', kind: 'mensal', descricao_base: 'Spotify', status: 'concluida', valor_total: 20, parcelas_total: 12, parcelas_pct: 100, data_inicio: isoDiasAtras(10), proxima_parcela: null, categorias: null, subcategorias: null },
  ]

  it('null passa adiante', () => {
    expect(filtrarGruposParcelados(null, '', 'todas', 'recent')).toBeNull()
  })

  it('filtra por status', () => {
    expect(filtrarGruposParcelados(grupos, '', 'concluidas', 'recent').map((g) => g.id)).toEqual(['b'])
  })

  it('busca por descrição', () => {
    expect(filtrarGruposParcelados(grupos, 'gela', 'todas', 'recent').map((g) => g.id)).toEqual(['a'])
  })

  it('ordena por valor desc', () => {
    expect(filtrarGruposParcelados(grupos, '', 'todas', 'value').map((g) => g.id)).toEqual(['a', 'b'])
  })
})

describe('segmentarGrupos', () => {
  it('separa parcelados de mensais', () => {
    const r = segmentarGrupos([{ kind: 'parcelado' }, { kind: 'mensal' }, { kind: 'parcelado' }])
    expect(r.parcelados).toHaveLength(2)
    expect(r.mensais).toHaveLength(1)
  })
  it('null passa adiante', () => {
    expect(segmentarGrupos(null)).toBeNull()
  })
})

describe('calcularTotaisParcelados', () => {
  it('soma geral, pago e restante; mês corrente conta parcela do mês', () => {
    const grupos = [
      {
        kind: 'parcelado',
        valor_total: 300,
        valor_pago: 100,
        valor_restante: 200,
        parcelas: [
          { valor: 100, status: 'EFETIVADA', data_transacao: `${ymAtual}-05` },
          { valor: 100, status: 'PENDENTE', data_transacao: `${ymAtual}-15` },
        ],
      },
    ]
    const r = calcularTotaisParcelados(grupos)
    expect(r.totalGeral).toBe(300)
    expect(r.totalPago).toBe(100)
    expect(r.totalRestante).toBe(200)
    // duas parcelas no mês corrente → totalMes = 200; pago no mês = 100 → falta 100
    expect(r.totalMes).toBe(200)
    expect(r.faltaNoMes).toBe(100)
  })

  it('null passa adiante', () => {
    expect(calcularTotaisParcelados(null)).toBeNull()
  })
})
