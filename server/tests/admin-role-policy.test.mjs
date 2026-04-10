import { describe, it, expect } from 'vitest'
import { normalizeRoleKey, actorCanAssignAdminRole } from '../lib/admin-role-policy.mjs'

describe('admin-role-policy', () => {
  it('normalizeRoleKey trata vazio e mistura de caixa', () => {
    expect(normalizeRoleKey(undefined)).toBe('USER')
    expect(normalizeRoleKey(' admin ')).toBe('ADMIN')
    expect(normalizeRoleKey('readonly')).toBe('READONLY')
  })

  it('actorCanAssignAdminRole só para e-mail principal', () => {
    expect(actorCanAssignAdminRole('mestredamente@mestredamente.com')).toBe(true)
    expect(actorCanAssignAdminRole('outro@email.com')).toBe(false)
    expect(actorCanAssignAdminRole('')).toBe(false)
  })
})
