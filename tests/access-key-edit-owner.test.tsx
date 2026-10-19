import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { normalizeAccessKey } from '../src/lib/api/management/access-keys'

const fixture = fileURLToPath(new URL('./fixtures/access-key-owner.tsx', import.meta.url))

describe('Issue #202 access key edit owner binding', () => {
  test('normalizeAccessKey treats user_id 0 as unassigned null and positive user_id as bound', () => {
    const unassigned = normalizeAccessKey({ id: 1, api_key: 'sk-test-1', user_id: 0 }, 0)
    expect(unassigned.userId).toBeNull()

    const bound = normalizeAccessKey({ id: 2, api_key: 'sk-test-2', user_id: 2 }, 1)
    expect(bound.userId).toBe(2)
  })

  for (const scenario of [
    'direct-edit',
    'deleted-owner',
    'deleted-owner-reassign',
    'deleted-owner-unassign',
    'missing-owner',
    'delayed-users',
    'change-owner',
    'unassign-owner',
    'empty-native-change',
    'change-resource',
  ]) {
    test(`owner display and PATCH payload: ${scenario}`, () => {
      const result = spawnSync(process.execPath, [fixture, scenario], {
        encoding: 'utf8',
        timeout: 10_000,
      })
      expect(result.error, result.stderr).toBeUndefined()
      expect(result.status, result.stdout + result.stderr).toBe(0)
    })
  }
})
