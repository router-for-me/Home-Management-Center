import { afterEach, describe, expect, test } from 'bun:test'

import {
  createDefaultModelPriceImportPreferences,
  readModelPriceImportPreferences,
  writeModelPriceImportPreferences,
} from '../../src/lib/billing/model-price-import-preferences'

function installStorage() {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  })
  return values
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
})

describe('model price import preferences', () => {
  test('round-trips editable rules and aliases without persisting row-specific overrides', () => {
    installStorage()
    const preferences = createDefaultModelPriceImportPreferences()
    preferences.overwriteMode = 'sync'
    preferences.targetFilter = 'synced'
    preferences.policy.rules[0].multiplier = 3
    preferences.policy.aliases[0].sourceModels = ['custom-source']
    preferences.policy.rowMultipliers['provider::model'] = 9

    expect(writeModelPriceImportPreferences('http://backend', preferences)).toBe(true)
    const restored = readModelPriceImportPreferences('http://backend')
    expect(restored.overwriteMode).toBe('sync')
    expect(restored.targetFilter).toBe('synced')
    expect(restored.policy.rules[0].multiplier).toBe(3)
    expect(restored.policy.aliases[0].sourceModels).toEqual(['custom-source'])
    expect(restored.policy.rowMultipliers).toEqual({})
  })

  test('falls back to safe defaults for malformed storage', () => {
    const storage = installStorage()
    storage.set('hmc.billing.model-price-import.preferences:http%3A%2F%2Fbackend', '{bad json')
    const restored = readModelPriceImportPreferences('http://backend')
    expect(restored.overwriteMode).toBe('missing')
    expect(restored.policy.includeZeroCost).toBe(false)
    expect(restored.policy.rules.length).toBeGreaterThan(0)
  })

  test('rejects persisted zero multipliers', () => {
    const storage = installStorage()
    const preferences = createDefaultModelPriceImportPreferences()
    preferences.policy.defaultMultiplier = 0
    storage.set(
      'hmc.billing.model-price-import.preferences:http%3A%2F%2Fbackend',
      JSON.stringify({
        version: 1,
        overwriteMode: preferences.overwriteMode,
        targetFilter: preferences.targetFilter,
        policy: preferences.policy,
      }),
    )

    const restored = readModelPriceImportPreferences('http://backend')
    expect(restored.policy.defaultMultiplier).toBe(1)
  })
})
