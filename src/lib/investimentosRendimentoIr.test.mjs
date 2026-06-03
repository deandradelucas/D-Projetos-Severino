import { describe, expect, it } from 'vitest'
import {
  contarDiasUteisComJurosAteYmd,
  contarDiasUteisComJurosDesdeIso,
  diasCorridosDesdeIso,
  diasCorridosEntreReferenciasIso,
  ehDiaUtilComPregaoCdi,
  DIAS_UTEIS_ANO_RENDIMENTO,
  estimativaRendimentoAcumuladoAteHoje,
  estimativaRendimentoDiarioComIr,
  extrairYyyyMmDdReferencia,
  taxaEfetivaAaContratada,
} from './investimentosRendimentoIr.js'

describe('extrairYyyyMmDdReferencia', () => {
  it('extrai prefixo YYYY-MM-DD de ISO com hora', () => {
    expect(extrairYyyyMmDdReferencia('2025-11-10T03:00:00.000Z')).toBe('2025-11-10')
  })

  it('aceita número (ms)', () => {
    const ms = Date.parse('2025-11-10T12:00:00')
    expect(extrairYyyyMmDdReferencia(ms)).toBeTruthy()
  })
})

describe('diasCorridosDesdeIso', () => {
  it('usa calendário local a partir de ISO com sufixo', () => {
    const n = diasCorridosDesdeIso('2025-11-10T00:00:00.000Z')
    expect(n).not.toBeNull()
    expect(Number.isFinite(n)).toBe(true)
  })
})

describe('contarDiasUteisComJurosAteYmd', () => {
  it('alinha com contagem até a mesma data em YYYY-MM-DD (rendimento só após 1.º dia útil pós-aquisição)', () => {
    const ate = contarDiasUteisComJurosAteYmd('2025-06-09', '2025-06-10')
    const ref = contarDiasUteisComJurosDesdeIso('2025-06-09', new Date('2025-06-10T12:00:00'))
    expect(ate).toBe(ref)
    expect(ate).toBe(1)
  })

  it('retorna null se data final inválida', () => {
    expect(contarDiasUteisComJurosAteYmd('2025-06-09', '')).toBe(null)
  })
})

describe('diasCorridosEntreReferenciasIso', () => {
  it('conta dias corridos entre calendários locais', () => {
    expect(diasCorridosEntreReferenciasIso('2025-06-10T12:00:00', '2025-06-15')).toBe(5)
    expect(diasCorridosEntreReferenciasIso('2025-06-15', '2025-06-10')).toBe(0)
  })
})

describe('contarDiasUteisComJurosDesdeIso', () => {
  it('no dia da aquisição não rende — mesmo dia útil conta 0', () => {
    // Ter 10 jun 2025 — próximo pregão = qua 11
    expect(contarDiasUteisComJurosDesdeIso('2025-06-10', new Date('2025-06-10T15:00:00'))).toBe(0)
  })

  it('do 2.º dia útil após aquisição: segunda → terça = 1 dia útil', () => {
    expect(contarDiasUteisComJurosDesdeIso('2025-06-09', new Date('2025-06-10T12:00:00'))).toBe(1)
  })

  it('sexta aplica; só segunda seguinte rende → 1 dia útil', () => {
    expect(contarDiasUteisComJurosDesdeIso('2025-06-06', new Date('2025-06-09T23:59:59'))).toBe(1)
  })

  it('sexta Santa + Sexta-feira Santa: primeiro pregão após quinta é segunda seguinte', () => {
    expect(contarDiasUteisComJurosDesdeIso('2025-04-17', new Date('2025-04-18T12:00:00'))).toBe(0)
  })

  it('retorna null para ISO inválido', () => {
    expect(contarDiasUteisComJurosDesdeIso('', new Date('2025-01-01'))).toBe(null)
    expect(contarDiasUteisComJurosDesdeIso(null, new Date('2025-01-01'))).toBe(null)
  })
})

describe('estimativaRendimentoAcumuladoAteHoje', () => {
  it('acumulado por compostos em 252 d.u.; IR sobre bruto acumulado', () => {
    const du = 10
    const daily = estimativaRendimentoDiarioComIr(10_000, 100, 10, 30, false)
    expect(daily).not.toBeNull()
    const ac = estimativaRendimentoAcumuladoAteHoje(10_000, 100, 10, 30, false, du)
    expect(ac?.diasUteisAcumulacao).toBe(du)
    const te = taxaEfetivaAaContratada(100, 10, 'CDI')
    const brutoEsp = 10_000 * (Math.pow(1 + te / 100, du / DIAS_UTEIS_ANO_RENDIMENTO) - 1)
    expect(ac?.brutoAcumulado).toBeCloseTo(brutoEsp, 6)
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

  it('20/nov/2023 (Consciência Negra, 1.º ano federal) retorna false', () => {
    expect(ehDiaUtilComPregaoCdi(new Date('2023-11-20T12:00:00'))).toBe(false)
  })

  it('20/nov/2020 (sexta — antes de ser feriado federal) retorna true — pregão normal', () => {
    // 20/nov/2020 é sexta-feira; lei 14.759/2023 não existia → não era feriado CDI
    expect(ehDiaUtilComPregaoCdi(new Date('2020-11-20T12:00:00'))).toBe(true)
  })

  it('20/nov/2024 retorna false (feriado federal mantido)', () => {
    expect(ehDiaUtilComPregaoCdi(new Date('2024-11-20T12:00:00'))).toBe(false)
  })
})

describe('contarDiasUteisComJurosDesdeIso — Consciência Negra', () => {
  it('20/nov/2020 (sexta) conta como dia útil — pré-2023', () => {
    // Aquisição 19/nov/2020 (qui), D+1 = 20/nov (sex) que NÃO era feriado federal
    const du = contarDiasUteisComJurosAteYmd('2020-11-19', '2020-11-20')
    expect(du).toBe(1)
  })

  it('aquisição 19/nov/2023 (dom): D+1=seg 20/nov é feriado → 1.º pregão = ter 21/nov', () => {
    // D+1 do domingo = segunda 20/nov/2023 = FERIADO federal em 2023 → skip
    // Próximo dia útil com pregão = terça 21/nov/2023
    // contarDiasUteisComJurosAteYmd até 21/nov/2023 = 1 dia útil
    const du = contarDiasUteisComJurosAteYmd('2023-11-19', '2023-11-21')
    expect(du).toBe(1)
  })

  it('período 17-24/nov/2023: semana inclui feriado 20/nov → 4 dias úteis (não 5)', () => {
    // D+1 de 17/nov/2023 (sex) = sáb 18 → próximo útil = seg 20 (FERIADO) → ter 21
    // Dias úteis: 21, 22, 23, 24 = 4
    const du2023 = contarDiasUteisComJurosAteYmd('2023-11-17', '2023-11-24')
    expect(du2023).toBe(4)
  })

  it('período equivalente em 2020: semana 20/nov sexta conta → 5 dias úteis', () => {
    // D+1 de 17/nov/2020 (ter) = qua 18
    // Dias úteis 18, 19, 20, 23, 24 = 5 (19=qui, 20=sex conta pois não era feriado federal)
    // 17/nov=ter, D+1=18/nov(qua), período até 24/nov(ter): 18,19,20,23,24 = 5
    const du2020 = contarDiasUteisComJurosAteYmd('2020-11-17', '2020-11-24')
    expect(du2020).toBe(5)
  })
})
