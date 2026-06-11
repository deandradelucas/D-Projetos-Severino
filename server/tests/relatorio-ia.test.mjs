import { describe, expect, it } from 'vitest'
import { formatarRelatorioIA, avaliarTelemetriaIA } from '../lib/relatorio-ia.mjs'

describe('formatarRelatorioIA', () => {
  it('monta o painel com fontes, tendência e top correções', () => {
    const msg = formatarRelatorioIA({
      titulos_7d: 10,
      titulos_editados_7d: 2,
      score_medio_7d: 0.91,
      fontes_7d: { groq: 6, gemini: 4 },
      correcoes_categoria_7d: 3,
      correcoes_categoria_7d_ant: 1,
      heuristica_override_7d: 2,
      transacoes_7d: 150,
      top_correcoes_90d: [{ descricao: 'gás do condomínio', categoria_nome: 'Moradia', vezes: 3 }],
      titulos_editados_30d: [{ mensagem: 'me lembra...', titulo_gerado: 'Pagar a luz', titulo_editado: 'Conta de luz' }],
    })
    expect(msg).toContain('10 títulos')
    expect(msg).toContain('20% editados')
    expect(msg).toContain('groq 6')
    expect(msg).toContain('3 correções (↑ vs 1')
    expect(msg).toContain('"gás do condomínio" → Moradia (3x)')
    expect(msg).toContain('"Pagar a luz" → "Conta de luz"')
  })

  it('semana vazia ganha nota de volume baixo', () => {
    const msg = formatarRelatorioIA({ titulos_7d: 0, correcoes_categoria_7d: 0, transacoes_7d: 5 })
    expect(msg).toContain('volume ainda baixo')
  })
})

describe('avaliarTelemetriaIA — regras do watchdog', () => {
  it('alerta Gemini degradado (≥5 falhas e ≥30%)', () => {
    const alertas = avaliarTelemetriaIA({ dia: 'x', 'gemini:parse-tx:ok': 10, 'gemini:parse-tx:fail': 6 })
    expect(alertas).toHaveLength(1)
    expect(alertas[0].nivel).toBe('error')
    expect(alertas[0].texto).toContain('6 falhas')
  })

  it('NÃO alerta com poucas falhas ou taxa baixa', () => {
    expect(avaliarTelemetriaIA({ 'gemini:parse-tx:ok': 100, 'gemini:parse-tx:fail': 4 })).toHaveLength(0)
    expect(avaliarTelemetriaIA({ 'gemini:parse-tx:ok': 100, 'gemini:parse-tx:fail': 10 })).toHaveLength(0)
  })

  it('avisa fallback Groq ativo (≥5 chamadas ok)', () => {
    const alertas = avaliarTelemetriaIA({ 'groq:parse-tx:ok': 5, 'gemini:parse-tx:fail': 2 })
    expect(alertas).toHaveLength(1)
    expect(alertas[0].nivel).toBe('warn')
  })

  it('soma falhas entre fluxos (parse-tx + lista + titulo)', () => {
    const alertas = avaliarTelemetriaIA({
      'gemini:parse-tx:fail': 2,
      'gemini:lista:fail': 2,
      'gemini:titulo-agenda:fail': 2,
      'gemini:parse-tx:ok': 4,
    })
    expect(alertas.some((a) => a.nivel === 'error')).toBe(true)
  })

  it('snapshot vazio/sem tráfego → sem alertas', () => {
    expect(avaliarTelemetriaIA({ dia: '2026-06-11' })).toHaveLength(0)
    expect(avaliarTelemetriaIA(null)).toHaveLength(0)
  })
})
