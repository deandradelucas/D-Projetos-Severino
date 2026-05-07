import { log } from './logger.mjs'

/** Log estruturado para grep / agregador (Datadog, etc.). */
export function logAsaasWebhook(event) {
  const line = {
    svc: 'asaas-webhook',
    t: new Date().toISOString(),
    ...event,
  }
  log.jsonLine(line)
}
