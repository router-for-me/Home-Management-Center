import { describe, expect, test } from 'bun:test'

import { formatUserReference } from '@/features/billing/billing-workbench-page'
import type { UserResource } from '@/lib/api/management/users'

// `billing_charge` stores a user id and no name, and the API never sends one,
// so a charge row can only name its user by joining the users snapshot the
// billing page already loads (issue #126).
function user(numericId: number, username: string): UserResource {
  return {
    id: String(numericId),
    numericId,
    username,
    hasPassword: true,
    credits: 0,
    creditsUnlimited: false,
    periodLimits: {
      creditsUnlimited: false,
      timezone: 'UTC',
      windows: {} as UserResource['periodLimits']['windows'],
    },
    periodLimitsSummary: null,
    mfaConfigured: false,
    passkeyCount: 0,
    deletedAt: null,
    createdAt: null,
    updatedAt: null,
    raw: {},
  }
}

const users = [user(7, 'alice'), user(9, 'bob')]
const fallback = '—'

describe('billing user reference', () => {
  test('resolves the name from the users snapshot when the record carries none', () => {
    expect(formatUserReference('', 7, users, fallback)).toBe('alice (#7)')
  })

  test('keeps the id readable when the user is not in the snapshot', () => {
    // A deleted user, or a snapshot that has not loaded yet. The id still
    // identifies the payer, so it beats showing nothing.
    expect(formatUserReference('', 42, users, fallback)).toBe('#42')
    expect(formatUserReference('', 42, [], fallback)).toBe('#42')
  })

  test('prefers the snapshot identity over a name carried on the record', () => {
    // Should the API start sending a username, the snapshot stays canonical so
    // a renamed account does not read two ways on one screen.
    expect(formatUserReference('stale-name', 9, users, fallback)).toBe('bob (#9)')
  })

  test('falls back to the record name when the id resolves nothing', () => {
    expect(formatUserReference('carol', 42, users, fallback)).toBe('carol (#42)')
    expect(formatUserReference('carol', null, users, fallback)).toBe('carol')
  })

  test('falls back only when there is neither a name nor an id', () => {
    expect(formatUserReference('', null, users, fallback)).toBe(fallback)
  })
})
