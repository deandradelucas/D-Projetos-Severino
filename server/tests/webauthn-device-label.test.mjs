import { describe, it, expect } from 'vitest'
import { deviceLabelFromUA } from '../lib/webauthn.mjs'

describe('deviceLabelFromUA', () => {
  it('iPhone + Safari', () => {
    expect(deviceLabelFromUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari')
  })
  it('Android + Chrome (Android vence Linux, Chrome vence Safari)', () => {
    expect(deviceLabelFromUA('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36')).toBe('Android · Chrome')
  })
  it('Windows + Edge (Edg vence Chrome)', () => {
    expect(deviceLabelFromUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')).toBe('Windows · Edge')
  })
  it('Mac + Safari', () => {
    expect(deviceLabelFromUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe('Mac · Safari')
  })
  it('vazio → Dispositivo', () => {
    expect(deviceLabelFromUA('')).toBe('Dispositivo')
    expect(deviceLabelFromUA(null)).toBe('Dispositivo')
  })
})
