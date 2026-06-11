import { describe, expect, it } from 'vitest'
import { parseAgendaRecorrencia } from '../lib/domain/agenda-whatsapp.mjs'
import { lerHistoricoConversa, registrarTrocaConversa } from '../lib/domain/wa-conversa.mjs'

describe('parseAgendaRecorrencia', () => {
  it('detecta diária ("todo dia", "todos os dias", "diariamente")', () => {
    expect(parseAgendaRecorrencia('me lembra de tomar remédio todo dia às 8h')).toEqual({ freq: 'DIARIA', count: 14 })
    expect(parseAgendaRecorrencia('me lembra todos os dias de beber água')).toEqual({ freq: 'DIARIA', count: 14 })
    expect(parseAgendaRecorrencia('me avise diariamente às 7h')).toEqual({ freq: 'DIARIA', count: 14 })
  })

  it('detecta "todo dia 5" como MENSAL no dia 5 (não diária)', () => {
    expect(parseAgendaRecorrencia('me lembra de pagar o aluguel todo dia 5')).toEqual({ freq: 'MENSAL', count: 6, diaMes: 5 })
  })

  it('detecta semanal ("toda segunda", "toda sexta-feira", "toda semana")', () => {
    expect(parseAgendaRecorrencia('reunião toda segunda às 10h')).toEqual({ freq: 'SEMANAL', count: 8 })
    expect(parseAgendaRecorrencia('me lembra toda sexta-feira de enviar o relatório')).toEqual({ freq: 'SEMANAL', count: 8 })
    expect(parseAgendaRecorrencia('me avise toda semana')).toEqual({ freq: 'SEMANAL', count: 8 })
  })

  it('detecta mensal ("todo mês", "mensalmente")', () => {
    expect(parseAgendaRecorrencia('me lembra de pagar a internet todo mês')).toEqual({ freq: 'MENSAL', count: 6 })
    expect(parseAgendaRecorrencia('mensalmente me avise do boleto')).toEqual({ freq: 'MENSAL', count: 6 })
  })

  it('respeita horizonte explícito "por N ..."', () => {
    expect(parseAgendaRecorrencia('remédio todo dia por 2 semanas')).toEqual({ freq: 'DIARIA', count: 14 })
    expect(parseAgendaRecorrencia('remédio todo dia por 5 dias')).toEqual({ freq: 'DIARIA', count: 5 })
    expect(parseAgendaRecorrencia('aluguel todo mês por 3 meses')).toEqual({ freq: 'MENSAL', count: 3 })
    expect(parseAgendaRecorrencia('reunião toda segunda por 4 vezes')).toEqual({ freq: 'SEMANAL', count: 4 })
  })

  it('aplica caps (diária ≤31, mensal ≤12)', () => {
    expect(parseAgendaRecorrencia('remédio todo dia por 6 meses').count).toBe(31)
    expect(parseAgendaRecorrencia('aluguel todo mês por 24 meses').count).toBe(12)
  })

  it('retorna null sem recorrência', () => {
    expect(parseAgendaRecorrencia('marcar dentista amanhã às 15h')).toBeNull()
    expect(parseAgendaRecorrencia('me lembra de pagar a luz sexta 9h')).toBeNull()
  })
})

describe('wa-conversa — memória conversacional curta (fallback memória)', () => {
  it('registra e lê trocas no formato Gemini contents', async () => {
    const phone = '5511999000111'
    await registrarTrocaConversa(phone, 'qual meu saldo?', 'Seu saldo é R$ 100')
    const hist = await lerHistoricoConversa(phone)
    expect(hist).toEqual([
      { role: 'user', parts: [{ text: 'qual meu saldo?' }] },
      { role: 'model', parts: [{ text: 'Seu saldo é R$ 100' }] },
    ])
  })

  it('trunca para as últimas 12 mensagens (6 trocas)', async () => {
    const phone = '5511999000222'
    for (let i = 1; i <= 9; i++) {
      await registrarTrocaConversa(phone, `pergunta ${i}`, `resposta ${i}`)
    }
    const hist = await lerHistoricoConversa(phone)
    expect(hist).toHaveLength(12)
    expect(hist[0].parts[0].text).toBe('pergunta 4')
    expect(hist[11].parts[0].text).toBe('resposta 9')
  })

  it('telefones diferentes não compartilham histórico', async () => {
    await registrarTrocaConversa('5511999000333', 'oi', 'olá!')
    const outro = await lerHistoricoConversa('5511999000444')
    expect(outro).toEqual([])
  })
})
