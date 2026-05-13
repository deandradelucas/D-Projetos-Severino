import { describe, expect, it } from 'vitest'
import { buildBotBodyFromEvolutionPayload } from '../lib/whatsapp/whatsapp-evolution-inbound.mjs'

describe('buildBotBodyFromEvolutionPayload', () => {
  const audioInner = {
    audioMessage: { mimetype: 'audio/ogg; codecs=opus', url: '' },
  }

  it('aceita data plano (messages.upsert clássico)', () => {
    const bot = buildBotBodyFromEvolutionPayload({
      event: 'messages.upsert',
      instance: 'inst-a',
      data: {
        key: {
          remoteJid: '5511999887766@s.whatsapp.net',
          id: 'ABC',
          fromMe: false,
        },
        message: audioInner,
      },
    })
    expect(bot?.phone).toBe('5511999887766')
    expect(bot?.messageId).toBe('ABC')
    expect(bot?.evolutionInstance).toBe('inst-a')
    expect(bot?.mimeType).toContain('ogg')
  })

  it('aceita data.messages[]', () => {
    const bot = buildBotBodyFromEvolutionPayload({
      instance: 'inst-b',
      data: {
        messages: [
          {
            key: {
              remoteJid: '5511888776655@s.whatsapp.net',
              id: 'XYZ',
              fromMe: false,
            },
            message: audioInner,
          },
        ],
      },
    })
    expect(bot?.phone).toBe('5511888776655')
    expect(bot?.messageId).toBe('XYZ')
    expect(bot?.evolutionInstance).toBe('inst-b')
  })

  it('@lid + remoteJidAlt: telefone vem do PN (número real)', () => {
    const bot = buildBotBodyFromEvolutionPayload({
      body: {
        instance: 'inst-c',
        data: {
          key: {
            remoteJid: '234567890123456789@lid',
            remoteJidAlt: '5511999887766@s.whatsapp.net',
            id: 'L1',
            fromMe: false,
          },
          message: audioInner,
        },
      },
    })
    expect(bot?.phone).toBe('5511999887766')
    expect(bot?.remoteJid).toBe('234567890123456789@lid')
    expect(bot?.remoteJidAlt).toBe('5511999887766@s.whatsapp.net')
    expect(bot?.evolutionInstance).toBe('inst-c')
  })

  it('@lid sem Alt: mantém dígitos do LID (só bate com whatsapp_id no perfil)', () => {
    const bot = buildBotBodyFromEvolutionPayload({
      body: {
        instance: 'inst-c2',
        data: {
          key: {
            remoteJid: '5511777665544@lid',
            id: 'L2',
            fromMe: false,
          },
          message: audioInner,
        },
      },
    })
    expect(bot?.phone).toBe('5511777665544')
    expect(bot?.remoteJid).toContain('@lid')
  })

  it('desembrulha ephemeralMessage com áudio', () => {
    const bot = buildBotBodyFromEvolutionPayload({
      instance: 'inst-d',
      data: {
        key: {
          remoteJid: '5511666554433@s.whatsapp.net',
          id: 'E1',
          fromMe: false,
        },
        message: {
          ephemeralMessage: {
            message: audioInner,
          },
        },
      },
    })
    expect(bot?.phone).toBe('5511666554433')
    expect(bot?.messageId).toBe('E1')
  })

  it('ignora grupo e fromMe', () => {
    expect(
      buildBotBodyFromEvolutionPayload({
        data: {
          key: { remoteJid: '120@g.us', id: '1', fromMe: false },
          message: audioInner,
        },
      })
    ).toBeNull()
    expect(
      buildBotBodyFromEvolutionPayload({
        data: {
          key: { remoteJid: '5511999999999@s.whatsapp.net', id: '1', fromMe: true },
          message: audioInner,
        },
      })
    ).toBeNull()
  })
})
