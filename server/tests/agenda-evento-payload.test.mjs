import { describe, it, expect } from 'vitest'
import { buildEventoPayload } from '../lib/domain/agenda.mjs'

const USUARIO_ID = '11111111-1111-4111-8111-111111111111'

describe('agenda.mjs — buildEventoPayload (edição)', () => {
  it('monta payload de atualização com início e fim padrão', () => {
    const payload = buildEventoPayload(
      USUARIO_ID,
      {
        titulo: 'Reunião cliente',
        inicio: '2025-05-19T18:30:00.000Z',
        lembrar_minutos_antes: 15,
        whatsapp_notificar: true,
      },
      true,
    )

    expect(payload.titulo).toBe('Reunião cliente')
    expect(payload.inicio_em).toBe('2025-05-19T18:30:00.000Z')
    expect(payload.fim_em).toBeTruthy()
    expect(new Date(payload.fim_em).getTime()).toBeGreaterThan(new Date(payload.inicio_em).getTime())
    expect(payload.lembrete).toBe('15-min')
    expect(payload.usuario_id).toBeUndefined()
  })

  it('rejeita título curto na edição', () => {
    expect(() =>
      buildEventoPayload(
        USUARIO_ID,
        { titulo: 'R', inicio: '2025-05-19T18:30:00.000Z' },
        true,
      ),
    ).toThrow(/título/i)
  })
})
