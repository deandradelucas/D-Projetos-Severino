// @ts-check
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'

/**
 * Cookie HttpOnly do refresh token (Story S1).
 *
 * O refresh token NUNCA fica acessível ao JS do browser: XSS no máximo renova
 * um access token de 15min enquanto a página está aberta — não exfiltra a
 * sessão de 30 dias. Path restrito a /api/auth: o cookie só viaja nos requests
 * de refresh/logout, não em toda chamada da API.
 */

export const REFRESH_COOKIE_NAME = 'horizonte_rt'
const COOKIE_PATH = '/api/auth'

const TTL_DAYS = Number.parseInt(
  String(process.env.HORIZONTE_REFRESH_TOKEN_TTL_DAYS || '30').trim(),
  10,
) || 30

function isProd() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production'
}

function cookieOptions() {
  return {
    path: COOKIE_PATH,
    httpOnly: true,
    /* Secure só em produção: em dev o app roda em http://localhost e o Safari
     * não grava cookies Secure sem TLS. */
    secure: isProd(),
    sameSite: 'Strict',
    maxAge: TTL_DAYS * 24 * 60 * 60,
  }
}

export function setRefreshCookie(c, token) {
  setCookie(c, REFRESH_COOKIE_NAME, String(token || ''), cookieOptions())
}

export function readRefreshCookie(c) {
  return String(getCookie(c, REFRESH_COOKIE_NAME) || '').trim()
}

export function clearRefreshCookie(c) {
  deleteCookie(c, REFRESH_COOKIE_NAME, { path: COOKIE_PATH })
}
