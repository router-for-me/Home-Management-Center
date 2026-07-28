import { describe, expect, test } from 'bun:test'

import {
  normalizeColumnVisibilityOverrides,
  resolveVisibleColumns,
} from '../src/hooks/use-persistent-column-visibility'
import {
  type PreferenceStorage,
  createChoicePreferenceNormalizer,
  decodePreference,
  normalizeBooleanPreference,
  readPreference,
  uiPreferenceKeys,
  writePreference,
} from '../src/lib/ui-preferences'

function createStorage() {
  const values = new Map<string, string>()
  const storage: PreferenceStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }

  return { storage, values }
}

describe('UI preferences', () => {
  test('uses a unique storage key for every preference', () => {
    const keys = Object.values(uiPreferenceKeys)

    expect(new Set(keys).size).toBe(keys.length)
  })

  test('writes and reads a versioned preference envelope', () => {
    const { storage, values } = createStorage()

    expect(writePreference(storage, 'sidebar', false)).toBe(true)
    expect(values.get('sidebar')).toBe('{"version":1,"value":false}')
    expect(readPreference(storage, 'sidebar', true, normalizeBooleanPreference)).toBe(false)
  })

  test('falls back for unsupported versions and malformed JSON', () => {
    expect(decodePreference('{"version":2,"value":false}', true, normalizeBooleanPreference)).toBe(
      true,
    )
    expect(decodePreference('{bad json', true, normalizeBooleanPreference)).toBe(true)
  })

  test('falls back when storage access fails', () => {
    const storage: PreferenceStorage = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: () => {
        throw new Error('storage unavailable')
      },
    }

    expect(readPreference(storage, 'page-size', 25, () => 50)).toBe(25)
    expect(writePreference(storage, 'page-size', 50)).toBe(false)
  })

  test('rejects page sizes outside the current choices', () => {
    const normalizePageSize = createChoicePreferenceNormalizer([25, 50, 100])

    expect(decodePreference('{"version":1,"value":75}', 25, normalizePageSize)).toBe(25)
    expect(decodePreference('{"version":1,"value":50}', 25, normalizePageSize)).toBe(50)
  })

  test('keeps required and newly defaulted columns while ignoring removed columns', () => {
    const columns = [
      { key: 'request', required: true },
      { key: 'provider' },
      { key: 'latency' },
      { key: 'newColumn' },
    ] as const
    const defaults = ['request', 'provider', 'newColumn'] as const
    const stored = {
      request: false,
      provider: false,
      latency: true,
      removedColumn: true,
    }

    const overrides = normalizeColumnVisibilityOverrides(stored, columns)

    expect(overrides).toEqual({ provider: false, latency: true })
    expect(resolveVisibleColumns(columns, defaults, overrides ?? {})).toEqual([
      'request',
      'latency',
      'newColumn',
    ])
  })

  test('preserves an explicit column override when a later default matches it', () => {
    const columns = [{ key: 'provider' }] as const

    expect(normalizeColumnVisibilityOverrides({ provider: false }, columns)).toEqual({
      provider: false,
    })
  })
})
