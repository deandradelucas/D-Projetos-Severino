/**
 * Funcionalidades opcionais / em preparação.
 *
 * Agenda: item no menu lateral e rota `/agenda`.
 * - Padrão atual: **oculta**.
 * - Para voltar a mostrar: defina `VITE_SHOW_AGENDA=true` no `.env` ou `DEV_FORCE_AGENDA` abaixo como `true`.
 */

/** Ative só no seu ambiente local para testar sem alterar .env */
export const DEV_FORCE_AGENDA = false

export const SHOW_AGENDA = DEV_FORCE_AGENDA || import.meta.env.VITE_SHOW_AGENDA === 'true'
