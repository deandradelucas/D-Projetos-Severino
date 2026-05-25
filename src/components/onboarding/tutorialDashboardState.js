const TUTORIAL_KEY = 'horizonte_tutorial_transacao_visto'

export function tutorialDashboardFoiVisto() {
  try { return Boolean(localStorage.getItem(TUTORIAL_KEY)) }
  catch { return true }
}

export function marcarTutorialDashboardVisto() {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1')
  } catch {
    // localStorage indisponível (modo privado, quota): ignora silenciosamente
  }
}
