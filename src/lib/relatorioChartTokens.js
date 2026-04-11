const COLORS_DESP = ['#38bdf8', '#34d399', '#fbbf24', '#fb923c', '#a78bfa', '#f472b6', '#94a3b8', '#64748b']
const COLORS_REC = ['#4ade80', '#22d3ee', '#fcd34d', '#a78bfa', '#f472b6', '#94a3b8', '#64748b']
const COLORS_PIE_MONO_DESP = ['#3a3a3a', '#4a4a4a', '#5a5a5a', '#6b6b6b', '#7c7c7c', '#8e8e8e', '#a1a1a1', '#b5b5b5']
const COLORS_PIE_MONO_REC = ['#e5e5e5', '#d0d0d0', '#bbbbbb', '#a6a6a6', '#919191', '#7d7d7d', '#696969', '#565656']

/**
 * Tokens visuais dos gráficos de relatório (Recharts), alinhados ao tema claro ou modo monocromático.
 * @param {boolean} chartMonochrome
 */
export function getRelatorioChartPalette(chartMonochrome) {
  return {
    axis: chartMonochrome ? '#525252' : '#94a3b8',
    tickFill: chartMonochrome ? '#a3a3a3' : '#475569',
    legend: chartMonochrome ? '#d4d4d4' : '#334155',
    tooltipBg: chartMonochrome ? '#0a0a0a' : '#ffffff',
    pieColorsDesp: chartMonochrome ? COLORS_PIE_MONO_DESP : COLORS_DESP,
    pieColorsRec: chartMonochrome ? COLORS_PIE_MONO_REC : COLORS_REC,
    pieStroke: chartMonochrome ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)',
    cursorFill: chartMonochrome ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.06)',
    barRecTop: chartMonochrome ? '#d4d4d4' : '#4ade80',
    barRecBot: chartMonochrome ? '#525252' : '#059669',
    barDesTop: chartMonochrome ? '#9ca3af' : '#fb7185',
    barDesBot: chartMonochrome ? '#404040' : '#dc2626',
    barRecurrTop: chartMonochrome ? '#a3a3a3' : '#2dd4bf',
    barRecurrBot: chartMonochrome ? '#404040' : '#0f766e',
  }
}
