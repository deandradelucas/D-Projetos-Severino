// Helpers de data no fuso de São Paulo (BRT). Brasil não tem horário de verão
// desde 2019 (offset fixo -03:00), mas usamos Intl para ser robusto a mudanças.
// Centraliza o cálculo de "hoje BRT" — antes cada módulo reimplementava com UTC,
// causando bugs de virada de dia (ex.: 21h BRT = 00h UTC do dia seguinte).

const TZ = 'America/Sao_Paulo'

/** Data de hoje (ou de `date`) em São Paulo no formato `YYYY-MM-DD`. */
export function hojeYmdBrt(date = new Date()) {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

/** Partes de calendário BRT como números: `{ ano, mes (1-12), dia }`. */
export function partesBrt(date = new Date()) {
  const [ano, mes, dia] = hojeYmdBrt(date).split('-').map(Number)
  return { ano, mes, dia }
}

/** Fim do dia BRT em ISO com offset (`YYYY-MM-DDT23:59:59.999-03:00`). */
export function fimDoDiaBrtIso(date = new Date()) {
  return `${hojeYmdBrt(date)}T23:59:59.999-03:00`
}
