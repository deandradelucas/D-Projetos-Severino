/**
 * Logs com timestamp ISO em uma linha (grep, agregadores, produção).
 * Para auditoria em JSON puro (ex.: webhook), use `log.jsonLine`.
 */
function ts() {
  return new Date().toISOString()
}

export const log = {
  info(...args) {
    console.log(ts(), '[info]', ...args)
  },
  warn(...args) {
    console.warn(ts(), '[warn]', ...args)
  },
  error(...args) {
    console.error(ts(), '[error]', ...args)
  },
  /** Uma linha JSON (objeto já deve trazer contexto, ex. svc, evento). */
  jsonLine(obj) {
    console.log(JSON.stringify(obj))
  },
}
