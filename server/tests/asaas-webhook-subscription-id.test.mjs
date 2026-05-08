import { describe, expect, it } from 'vitest'
import { subscriptionIdFromAsaasWebhookBody } from '../lib/asaas-webhook-subscription-id.mjs'

describe('subscriptionIdFromAsaasWebhookBody', () => {
  it('usa subscription.id', () => {
    expect(subscriptionIdFromAsaasWebhookBody({ subscription: { id: 'sub_abc' } })).toBe('sub_abc')
  })

  it('usa subscription.subscription quando id ausente', () => {
    expect(subscriptionIdFromAsaasWebhookBody({ subscription: { subscription: 'sub_xyz' } })).toBe('sub_xyz')
  })

  it('usa object subscription + id no topo', () => {
    expect(subscriptionIdFromAsaasWebhookBody({ object: 'subscription', id: 'sub_top' })).toBe('sub_top')
  })

  it('retorna vazio quando não há id', () => {
    expect(subscriptionIdFromAsaasWebhookBody({ subscription: {} })).toBe('')
    expect(subscriptionIdFromAsaasWebhookBody({})).toBe('')
  })
})
