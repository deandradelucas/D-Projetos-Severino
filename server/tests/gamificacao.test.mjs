import { describe, it, expect } from 'vitest'
import { prevDayYmd, calcularStreak, conquistasMerecidas, CONQUISTAS } from '../lib/gamificacao.mjs'

const set = (...ds) => new Set(ds)

describe('prevDayYmd', () => {
  it('volta um dia', () => {
    expect(prevDayYmd('2026-06-10')).toBe('2026-06-09')
  })
  it('atravessa virada de mês', () => {
    expect(prevDayYmd('2026-06-01')).toBe('2026-05-31')
  })
  it('atravessa virada de ano', () => {
    expect(prevDayYmd('2026-01-01')).toBe('2025-12-31')
  })
  it('lida com ano bissexto', () => {
    expect(prevDayYmd('2024-03-01')).toBe('2024-02-29')
  })
})

describe('calcularStreak', () => {
  const hoje = '2026-06-10'

  it('zero sem registros', () => {
    expect(calcularStreak(set(), hoje)).toBe(0)
  })

  it('zero se o último registro foi anteontem (já quebrou)', () => {
    expect(calcularStreak(set('2026-06-08'), hoje)).toBe(0)
  })

  it('1 com registro só hoje', () => {
    expect(calcularStreak(set('2026-06-10'), hoje)).toBe(1)
  })

  it('âncora em ontem: registrou ontem mas não hoje ainda conta', () => {
    expect(calcularStreak(set('2026-06-09', '2026-06-08'), hoje)).toBe(2)
  })

  it('conta dias consecutivos terminando hoje', () => {
    expect(calcularStreak(set('2026-06-10', '2026-06-09', '2026-06-08'), hoje)).toBe(3)
  })

  it('freeze: um buraco único não zera', () => {
    // hoje, ontem, [falta 08], 07, 06 → streak conta 4 (pula o 08 com freeze)
    expect(calcularStreak(set('2026-06-10', '2026-06-09', '2026-06-07', '2026-06-06'), hoje)).toBe(4)
  })

  it('segundo buraco quebra (freeze já usado)', () => {
    // hoje, ontem, [falta 08 - freeze], 07, [falta 06 - quebra], 05
    expect(calcularStreak(set('2026-06-10', '2026-06-09', '2026-06-07', '2026-06-05'), hoje)).toBe(3)
  })

  it('streak de 7 dias seguidos', () => {
    const ds = set('2026-06-10', '2026-06-09', '2026-06-08', '2026-06-07', '2026-06-06', '2026-06-05', '2026-06-04')
    expect(calcularStreak(ds, hoje)).toBe(7)
  })

  it('registros futuros/duplicados não inflam (Set já dedup; futuro ignorado pela âncora)', () => {
    expect(calcularStreak(set('2026-06-10', '2026-06-10'), hoje)).toBe(1)
  })
})

describe('conquistasMerecidas', () => {
  const base = { temMeta: false, temMetaConcluida: false, totalGuardado: 0, streak: 0 }

  it('nada merecido no estado zero', () => {
    expect(conquistasMerecidas(base).size).toBe(0)
  })

  it('meta criada destrava só meta_criada', () => {
    expect([...conquistasMerecidas({ ...base, temMeta: true })]).toEqual(['meta_criada'])
  })

  it('meta concluída destrava meta_concluida', () => {
    expect(conquistasMerecidas({ ...base, temMeta: true, temMetaConcluida: true }).has('meta_concluida')).toBe(true)
  })

  it('R$1k destrava guardado_1k; R$10k destrava ambos', () => {
    expect(conquistasMerecidas({ ...base, totalGuardado: 1000 }).has('guardado_1k')).toBe(true)
    expect(conquistasMerecidas({ ...base, totalGuardado: 999 }).has('guardado_1k')).toBe(false)
    const dez = conquistasMerecidas({ ...base, totalGuardado: 10000 })
    expect(dez.has('guardado_1k')).toBe(true)
    expect(dez.has('guardado_10k')).toBe(true)
  })

  it('streak 7 e 30', () => {
    expect(conquistasMerecidas({ ...base, streak: 7 }).has('streak_7')).toBe(true)
    expect(conquistasMerecidas({ ...base, streak: 6 }).has('streak_7')).toBe(false)
    const trinta = conquistasMerecidas({ ...base, streak: 30 })
    expect(trinta.has('streak_7')).toBe(true)
    expect(trinta.has('streak_30')).toBe(true)
  })
})

describe('catálogo CONQUISTAS', () => {
  it('tem as 6 do MVP com campos completos', () => {
    expect(CONQUISTAS).toHaveLength(6)
    const keys = CONQUISTAS.map((c) => c.key)
    expect(keys).toEqual(['meta_criada', 'meta_concluida', 'guardado_1k', 'guardado_10k', 'streak_7', 'streak_30'])
    for (const c of CONQUISTAS) {
      expect(c.nome && c.descricao && c.icone).toBeTruthy()
    }
  })
})
