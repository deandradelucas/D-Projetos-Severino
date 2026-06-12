/**
 * autoFocus só no desktop: no mobile, focar um input ao abrir o modal sobe o
 * teclado junto e cobre metade do sheet — o usuário quer VER o modal primeiro.
 * Uso: <input autoFocus={autoFocusDesktop()} />
 */
export function autoFocusDesktop() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches
}
