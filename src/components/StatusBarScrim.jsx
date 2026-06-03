import { useTheme } from '../context/ThemeContext'

/**
 * Pinta a faixa do safe-area do topo (área da status bar no iOS PWA) com a cor
 * do tema atual.
 *
 * Por que existe: no iOS standalone o WebKit NÃO repinta o topo quando a cor vem
 * do fundo do `<html>` ou da camada `app-background-root` (que é composta em GPU
 * via `contain: strict` + `translateZ(0)` e fica em `z-index: -1`) — só corrige
 * no relaunch. Este elemento é um `<div>` DOM normal, sem containment/transform,
 * com o fundo aplicado por inline style reativo do React: a troca de tema força
 * um recompose imediato da faixa, sem precisar fechar e reabrir o app.
 *
 * Cobre apenas `env(safe-area-inset-top)` e tem `pointer-events: none`, então não
 * interfere em nada do conteúdo (o header do shell já fica abaixo dessa faixa).
 */
export default function StatusBarScrim() {
  const { theme } = useTheme()
  const backgroundColor = theme === 'dark' ? '#080a0c' : '#ffffff'
  return <div className="status-bar-scrim" aria-hidden style={{ backgroundColor }} />
}
