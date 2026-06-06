import { describe, expect, it } from 'vitest'
import { isValidCpfCnpj } from '../lib/cpf-cnpj.mjs'

describe('isValidCpfCnpj', () => {
  it('aceita CPF válido (com e sem máscara)', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true)
    expect(isValidCpfCnpj('52998224725')).toBe(true)
  })

  it('aceita CNPJ válido', () => {
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(isValidCpfCnpj('52998224724')).toBe(false)
    expect(isValidCpfCnpj('11222333000182')).toBe(false)
  })

  it('rejeita sequências repetidas e comprimentos inválidos', () => {
    expect(isValidCpfCnpj('00000000000')).toBe(false)
    expect(isValidCpfCnpj('11111111111111')).toBe(false)
    expect(isValidCpfCnpj('123')).toBe(false)
    expect(isValidCpfCnpj('')).toBe(false)
  })
})
