/** Dimensões reais dos PNG Severino (IHDR). Evita proporção errada no layout e ajuda o escalonamento. */
export const BRAND_LOGO_PIXEL_SIZE = {
  severinoTemaClaro: { width: 1009, height: 382 },
}

export const BRAND_ASSETS = {
  /** Wordmark Severino — login e superfícies claras (`public/images/Nova Logo/`) */
  loginSeverinoLight: '/images/Nova Logo/Severino Tema Claro.png',
  /** Menu lateral — claro (`public/images/Nova Logo/Severino Tema Claro.png`)
   *  Mantido como histórico; o tema claro hoje renderiza `sidebarMarkLight`
   *  (símbolo quadrado) + wordmark "Severino" como texto separado. */
  sidebarLogo: '/images/Nova Logo/Severino Tema Claro.png',
  /** Símbolo "S" do tema claro (PNG quadrado, sem wordmark, sem tagline). */
  sidebarMarkLight: '/images/Nova Logo/logo.png',
  /** Símbolo do tema escuro — mesmo layout do claro (mark + wordmark). */
  sidebarMarkDark: '/images/Nova Logo/logo tema escuro.png',
  /** Menu lateral — escuro (legado; telas que ainda usam PNG completo) */
  sidebarLogoDark: '/images/Nova Logo/Tema Escuro.png',
  /** Alias usado em telas como BemVindoAssinatura / TrialExpirado */
  logo: '/images/Nova Logo/Tema Escuro.png',
  /** Ícone do app / PWA — cópia estável em `public/icons/` (evita espaços na URL no instalador mobile) */
  appIcon: '/icons/pwa-app-icon.png',
  appIconPng: '/icons/pwa-app-icon.png',
}
