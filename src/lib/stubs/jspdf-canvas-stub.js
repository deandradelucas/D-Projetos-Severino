/**
 * Stub vazio para `canvg` e `html2canvas` — dependências opcionais do jspdf 4.x.
 *
 * Por que existe:
 *   jspdf 4 importa estaticamente `canvg` e `html2canvas` para suportar `doc.svg()`,
 *   `doc.addSvgAsImage()` e `doc.html()`. Bundler (Vite/Rollup) então puxa ambas
 *   para o chunk mesmo quando o app só usa as APIs de tabela/texto. Isso adicionava
 *   ~95 KB gzipped (~351 KB raw) ao chunk lazy de Relatórios sem nenhum uso real.
 *
 * O que fazemos:
 *   `vite.config.js` aliasa `canvg` e `html2canvas` para este arquivo. Como
 *   Relatórios.jsx só chama `new jsPDF()` + `autoTable(...)` (texto e tabelas),
 *   nenhuma das funções stub abaixo é executada em produção.
 *
 * Se algum dia for preciso renderizar SVG ou capturar HTML em PDF:
 *   1. Remova o alias correspondente em `vite.config.js`.
 *   2. Importe `canvg`/`html2canvas` normalmente onde precisar.
 */

const stubError = (label) =>
  new Error(
    `[jspdf] ${label} foi chamado mas a dependência foi removida do bundle. ` +
      'Restaure o alias em vite.config.js ou remova o uso dessa API.',
  )

class CanvgStub {
  static from() {
    return Promise.reject(stubError('Canvg.from'))
  }
  static fromString() {
    throw stubError('Canvg.fromString')
  }
  start() {
    throw stubError('canvg.start')
  }
  stop() {
    /* no-op */
  }
  resize() {
    /* no-op */
  }
  render() {
    return Promise.reject(stubError('canvg.render'))
  }
}

function html2canvasStub() {
  return Promise.reject(stubError('html2canvas'))
}

export default CanvgStub
export const Canvg = CanvgStub
export const presets = {}
export { html2canvasStub }
