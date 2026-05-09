import { describe, expect, it } from 'vitest'
import { contarDiasUteisComJurosDesdeIso, ehDiaUtilComPregaoCdi } from './investimentosRendimentoIr.js'

describe('contarDiasUteisComJurosDesdeIso', () => {
  it('retorna 0 no mesmo dia civil', () => {
    expect(contarDiasUteisComJurosDesdeIso('2025-06-10', new Date('2025-06-10T15:00:00'))).toBe(0)
  })

  it('conta um dia útil quando o intervalo (início, fim] tem uma segunda-feira', () => {
    // Seg 9 jun 2025 → Ter 10 jun 2025: só conta terça
    expect(contarDiasUteisComJurosDesdeIso('2025-06-09', new Date('2025-06-10T12:00:00'))).toBe(1)
  })

  it('ignora fim de semana entre as datas', () => {
    // Sex 6 jun 2025 → Seg 9 jun 2025: sáb e dom sem pregão
    expect(contarDiasUteisComJurosDesdeIso('2025-06-06', new Date('2025-06-09T23:59:59'))).toBe(1)
  })

  it('ignora Sexta-feira Santa (feriado nacional)', () => {
    // Páscoa 2025 = 20 abr; Sexta Santa = 18 abr (sexta)
    expect(contarDiasUteisComJurosDesdeIso('2025-04-17', new Date('2025-04-18T12:00:00'))).toBe(0)
  })

  it('retorna null para ISO inválido', () => {
    expect(contarDiasUteisComJurosDesdeIso('', new Date('2025-01-01'))).toBe(null)
    expect(contarDiasUteisComJurosDesdeIso(null, new Date('2025-01-01'))).toBe(null)
  })
})

describe('ehDiaUtilComPregaoCdi', () => {
  it('sábado e domingo retornam false', () => {
    expect(ehDiaUtilComPregaoCdi(new Date('2026-05-09T12:00:00'))).toBe(false)
    expect(ehDiaUtilComPregaoCdi(new Date('2026-05-10T12:00:00'))).toBe(false)
  })

  it('segunda-feira comum retorna true', () => {
    expect(ehDiaUtilComPregaoCdi(new Date('2026-05-11T12:00:00'))).toBe(true)
  })

  it('Sexta-feira Santa retorna false', () => {
    expect(ehDiaUtilComPregaoCdi(new Date('2025-04-18T12:00:00'))).toBe(false)
  })
})
