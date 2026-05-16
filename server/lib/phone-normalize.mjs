/**
 * Utilitários puros de normalização de telefone brasileiro.
 * Sem dependências externas — funções determinísticas testáveis isoladamente.
 */

/**
 * Celular BR completo: 55 + DDD(2) + 9 dígitos = 13 caracteres.
 * Nunca aplicar slice(0,11) nesse formato — virava 55549969944 e sumia dígito (ex.: 54996994482).
 */
export function normalizarDigitosWhatsappLog(digitos) {
  const d = String(digitos || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('55') && d.length === 13) return d
  if (!d.startsWith('55') && d.length === 11 && /^\d{2}9\d{8}$/.test(d)) return `55${d}`
  if (d.startsWith('55') && d.length > 13) return d.slice(0, 13)
  return d
}

/**
 * Gera variantes com/sem DDI 55 para bater com o cadastro (ex.: 11999... vs 5511999...).
 * LID longo: truncar só quando não for E.164 BR 13 dígitos.
 */
export function variantesTelefoneBrasil(digitos) {
  const d = String(digitos || '').replace(/\D/g, '')
  if (!d) return []
  const out = new Set([d])

  // Lógica de 9º dígito para Brasil
  // Formatos: 55 + DDD + [9] + 8 dígitos
  if (d.length >= 10) {
    const isE164 = d.startsWith('55')
    const core = isE164 ? d.slice(2) : d
    const ddd = core.slice(0, 2)
    const rest = core.slice(2)

    // Se tem 10 dígitos (DDD + 8), tenta adicionar o 9
    if (core.length === 10) {
      const with9 = `${ddd}9${rest}`
      out.add(with9)
      if (isE164) out.add(`55${with9}`)
    }
    // Se tem 11 dígitos (DDD + 9 + 8), tenta remover o 9
    else if (core.length === 11 && rest.startsWith('9')) {
      const without9 = `${ddd}${rest.slice(1)}`
      out.add(without9)
      if (isE164) out.add(`55${without9}`)
    }
  }

  const isE164Br13 = d.startsWith('55') && d.length === 13
  const nacional13 = isE164Br13 ? d.slice(2) : ''

  if (isE164Br13) {
    out.add(nacional13)
  } else if (d.startsWith('55') && d.length > 2) {
    out.add(d.slice(2))
  }

  if (!d.startsWith('55') && d.length >= 10 && d.length <= 15) {
    out.add(`55${d}`)
  }

  if (d.startsWith('55') && d.length > 13) {
    const core = d.slice(0, 13)
    out.add(core)
    out.add(core.slice(2))
  } else if (!d.startsWith('55') && d.length > 11) {
    const h11 = d.slice(0, 11)
    out.add(h11)
    out.add(`55${h11}`)
  }

  if (d.length >= 11) {
    const t11 = d.slice(-11)
    out.add(t11)
    out.add(`55${t11}`)
  }

  return [...out]
}

/** Quando só um usuário tem telefone que "casa" pelo sufixo (9–13 dígitos). */
export function buscarUsuarioPorSufixoUnico(digitos, allUsers) {
  const d = String(digitos).replace(/\D/g, '')
  if (d.length < 8 || !allUsers?.length) return null

  for (const len of [13, 12, 11, 10, 9]) {
    if (d.length < len) continue
    const suf = d.slice(-len)
    const matches = allUsers.filter((u) => {
      const uc = String(u.telefone).replace(/\D/g, '')
      return uc === suf || uc.endsWith(suf) || suf.endsWith(uc)
    })
    if (matches.length === 1) return matches[0]
  }

  if (d.length >= 11) {
    const pre11 = d.slice(0, 11)
    const matches = allUsers.filter((u) => {
      const uc = String(u.telefone).replace(/\D/g, '')
      const nacional = uc.startsWith('55') ? uc.slice(2) : uc
      return nacional.slice(0, 11) === pre11 || nacional === pre11
    })
    if (matches.length === 1) return matches[0]
  }

  return null
}

/** Dígitos que parecem telefone BR (evita tratar LID 15+ dígitos como DDD+número). */
export function isProbablyBrazilPhoneDigits(d) {
  const x = String(d || '').replace(/\D/g, '')
  if (!x || x.length > 13) return false
  if (/^55\d{10,11}$/.test(x)) return true
  if (/^\d{10,11}$/.test(x)) return true
  if (/^\d{2}9\d{8}$/.test(x)) return true
  return false
}
