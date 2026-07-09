import { describe, expect, test } from 'bun:test'

import { parseModelsDevCatalog } from '../../src/lib/billing/models-dev-catalog'
import {
  applyMultiplierToCost,
  buildModelPriceImportRows,
  createDefaultImportPolicy,
  isImportRowSelectable,
  resolveImportMultiplier,
} from '../../src/lib/billing/models-dev-match'

const sampleCatalog = parseModelsDevCatalog({
  anthropic: {
    models: {
      'claude-sonnet-4-6': {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
      },
      'claude-opus-4-6': {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        cost: { input: 5, output: 25, cache_read: 0.5, cache_write: 6.25 },
      },
    },
  },
  google: {
    models: {
      'gemini-3.5-flash': {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        cost: { input: 1.5, output: 9, cache_read: 0.15 },
      },
      'gemini-3-flash': {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        cost: { input: 0.5, output: 3, cache_read: 0.05 },
      },
    },
  },
  xai: {
    models: {
      'grok-4.3': {
        id: 'grok-4.3',
        name: 'Grok 4.3',
        cost: { input: 1.25, output: 2.5, cache_read: 0.2 },
      },
    },
  },
})

describe('models-dev match', () => {
  test('resolves antigravity aliases and applies family multipliers only after match', () => {
    const policy = createDefaultImportPolicy()
    policy.rules = policy.rules.map((rule) =>
      rule.id === 'claude' ? { ...rule, multiplier: 3 } : rule,
    )

    const rows = buildModelPriceImportRows({
      catalog: sampleCatalog,
      policy,
      candidates: [
        { provider: 'antigravity', model: 'gemini-3-flash-agent', label: 'Gemini agent' },
        { provider: 'antigravity', model: 'claude-sonnet-4-6' },
        { provider: 'xai', model: 'grok-4.3' },
        { provider: 'antigravity', model: 'totally-unknown-model' },
      ],
    })

    const gemini = rows.find((row) => row.homeModel === 'gemini-3-flash-agent')
    expect(gemini?.status).toBe('matched')
    expect(gemini?.matchedProviderId).toBe('google')
    expect(gemini?.final?.input).toBe(1.5)
    expect(gemini?.final?.output).toBe(9)

    const claude = rows.find((row) => row.homeModel === 'claude-sonnet-4-6')
    expect(claude?.status).toBe('matched')
    expect(claude?.multiplier).toBe(3)
    expect(claude?.final?.input).toBe(9)
    expect(claude?.final?.output).toBe(45)
    expect(claude?.final?.cacheRead).toBeCloseTo(0.9)

    const grok = rows.find((row) => row.homeModel === 'grok-4.3')
    expect(grok?.status).toBe('matched')
    expect(isImportRowSelectable(grok!)).toBe(true)

    const unknown = rows.find((row) => row.homeModel === 'totally-unknown-model')
    expect(unknown?.status).toBe('unmatched')
    expect(isImportRowSelectable(unknown!)).toBe(false)
  })

  test('applyMultiplierToCost can drop cache fields', () => {
    const cost = applyMultiplierToCost(
      { input: 2, output: 4, cacheRead: 1, cacheWrite: 3, request: 0 },
      2,
      false,
    )
    expect(cost).toEqual({ input: 4, output: 8, cacheRead: 0, cacheWrite: 0, request: 0 })
  })

  test('resolveImportMultiplier uses first matching prefix', () => {
    const policy = createDefaultImportPolicy()
    policy.defaultMultiplier = 1
    policy.rules = [{ id: 'claude', label: 'Claude', modelPrefix: 'claude', multiplier: 3 }]
    expect(resolveImportMultiplier('claude-sonnet-4-6', policy)).toBe(3)
    expect(resolveImportMultiplier('gemini-3-flash', policy)).toBe(1)
  })
})
