import { describe, expect, it } from 'vitest'
import {
  contarDiasUteisComJurosDesdeIso,
  ehDiaUtilComPregaoCdi,
  estimativaRendimentoAcumuladoAteHoje,
  estimativaRendimentoDiarioComIr,
} from './investimentosRendimentoIr.js'

describe('contarDiasUteisComJurosDesdeIso', () => {
  it('no mesmo dia útil conta 1', () => {
    // Ter 10 jun 2025
    expect(contarDiasUteisComJurosDesdeIso('2025-06-10', new Date('2025-06-10T15:00:00'))).toBe(1)
  })

  it('intervalo inclusivo: segunda e terça = 2 dias úteis', () => {
    expect(contarDiasUteisComJurosDesdeIso('2025-06-09', new Date('2025-06-10T12:00:00'))).toBe(2)
  })

  it('ignora fim de semana entre as datas (sexta + segunda)', () => {
    expect(contarDiasUteisComJurosDesdeIso('2025-06-06', new Date('2025-06-09T23:59:59'))).toBe(2)
  })

  it('Sexta-feira Santa não conta; quinta anterior conta', () => {
    expect(contarDiasUteisComJurosDesdeIso('2025-04-17', new Date('2025-04-18T12:00:00'))).toBe(1)
  })

  it('retorna null para ISO inválido', () => {
    expect(contarDiasUteisComJurosDesdeIso('', new Date('2025-01-01'))).toBe(null)
    expect(contarDiasUteisComJurosDesdeIso(null, new Date('2025-01-01'))).toBe(null)
  })
})

describe('estimativaRendimentoAcumuladoAteHoje', () => {
  it('acumulado = diário × dias úteis (IR sobre bruto acumulado)', () => {
    const du = 10
    const daily = estimativaRendimentoDiarioComIr(10_000, 100, 10, 30, false)
    expect(daily).not.toBeNull()
    const ac = estimativaRendimentoAcumuladoAteHoje(10_000, 100, 10, 30, false, du)
    expect(ac?.diasUteisAcumulacao).toBe(du)
    expect(ac?.brutoAcumulado).toBeCloseTo(daily.bruto * du, 6)
    expect(ac?.impostoAcumulado).toBeCloseTo(ac.brutoAcumulado * daily.aliquota, 6)
    expect(ac?.liquidoAcumulado).toBeCloseTo(ac.brutoAcumulado - ac.impostoAcumulado, 6)
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
