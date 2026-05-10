/** Dimensões reais dos PNG Severino (IHDR). Evita proporção errada no layout e ajuda o escalonamento. */
export const BRAND_LOGO_PIXEL_SIZE = {
  severinoTemaClaro: { width: 1009, height: 382 },
  severinoPwaEscuro: { width: 415, height: 468 },
}

export const BRAND_ASSETS = {
  /** Wordmark Severino — login e superfícies claras (`public/images/Nova Logo/`) */
  loginSeverinoLight: '/images/Nova Logo/Severino Tema Claro.png',
  /** Menu lateral — claro: lockup horizontal; escuro: ícone PWA (S branco + detalhes ouro) em fundo #000 */
  sidebarLogoLightPng: '/images/Nova Logo/Severino Tema Claro.png',
  sidebarLogoDarkPng: '/images/Nova Logo/Severino Logo PWA Tema Escuro.png',
  /** Alias usado em telas como BemVindoAssinatura */
  logo: '/images/horizonte_fiel_original_logo_dark.svg',
  logoOnDark: '/images/horizonte_fiel_original_logo_dark.svg',
  /** SVG no repo — fallback quando PNG não carregar */
  logoOnLight: '/images/horizonte_fiel_original_logo_light.svg',
  /** Raster para menu (mobile: largura 100% sem depender de SVG inline) */
  logoOnLightPng: '/images/horizonte_fiel_original_logo_light.png',
  logoOnDarkPng: '/images/horizonte_fiel_original_logo_dark.png',
  /** Ícone do app / PWA — cópia estável em `public/icons/` (evita espaços na URL no instalador mobile) */
  appIcon: '/icons/pwa-app-icon.png',
  appIconPng: '/icons/pwa-app-icon.png',
}
