import { log } from './logger.mjs'

/** Log estruturado para grep / agregador (Datadog, etc.). */
export function logMpWebhook(event) {
  const line = {
    svc: 'mercadopago-webhook',
    t: new Date().toISOString(),
    ...event,
  }
  log.jsonLine(line)
}
