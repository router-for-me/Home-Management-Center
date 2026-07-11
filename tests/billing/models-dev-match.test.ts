import { describe, expect, test } from 'bun:test'

import { parseModelsDevCatalog } from '../../src/lib/billing/models-dev-catalog'
import {
  applyMultiplierToCost,
  buildModelPriceImportRows,
  createDefaultImportPolicy,
  isImportRowSelectable,
  isModelPriceImportRowApplicable,
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

const edgeCatalog = parseModelsDevCatalog({
  openai: {
    models: {
      'gpt-free-preview': {
        id: 'gpt-free-preview',
        name: 'GPT Free Preview',
        cost: { input: 0, output: 0, cache_read: 0, cache_write: 0, request: 0 },
      },
      'gpt-missing-cost': {
        id: 'gpt-missing-cost',
        name: 'GPT Missing Cost',
      },
      'gpt-request-only': {
        id: 'gpt-request-only',
        name: 'GPT Request Only',
        cost: { request: 0.25 },
      },
      'gpt-image-only': {
        id: 'gpt-image-only',
        name: 'GPT Image Only',
        cost: { image: 0.04 },
      },
      'gpt-negative-price': {
        id: 'gpt-negative-price',
        name: 'GPT Negative Price',
        cost: { input: -1, output: 2 },
      },
      'gpt-tiered-price': {
        id: 'gpt-tiered-price',
        name: 'GPT Tiered Price',
        cost: {
          input: 5,
          output: 30,
          tiers: [
            {
              input: 10,
              output: 45,
              tier: { type: 'context', size: 272000 },
            },
          ],
          context_over_200k: { input: 10, output: 45 },
        },
      },
      'gpt-reasoning-price': {
        id: 'gpt-reasoning-price',
        name: 'GPT Reasoning Price',
        cost: { input: 1, output: 2, reasoning: 3 },
      },
    },
  },
  openrouter: {
    models: {
      'third-party-shared': {
        id: 'third-party-shared',
        name: 'Third Party Shared',
        cost: { input: 1, output: 2 },
      },
    },
  },
  requesty: {
    models: {
      'third-party-shared': {
        id: 'third-party-shared',
        name: 'Third Party Shared',
        cost: { input: 1.2, output: 2.4 },
      },
    },
  },
  anthropic: {
    models: {
      'claude-sonnet-4-6': {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
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
    },
  },
})

describe('models-dev match', () => {
  test('preserves whether models.dev explicitly configured a cache-write price', () => {
    const configured = sampleCatalog.models.find((entry) => entry.modelId === 'claude-sonnet-4-6')
    const omitted = sampleCatalog.models.find((entry) => entry.modelId === 'gemini-3.5-flash')

    expect(configured?.cost?.cacheWrite).toBe(3.75)
    expect(configured?.cost?.cacheWriteConfigured).toBe(true)
    expect(omitted?.cost?.cacheWrite).toBe(0)
    expect(omitted?.cost?.cacheWriteConfigured).toBe(false)
  })

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
      {
        input: 2,
        output: 4,
        cacheRead: 1,
        cacheWrite: 3,
        cacheWriteConfigured: true,
        request: 0,
      },
      2,
      false,
    )
    expect(cost).toEqual({
      input: 4,
      output: 8,
      cacheRead: 0,
      cacheWrite: 0,
      cacheWriteConfigured: false,
      request: 0,
    })
  })

  test('resolveImportMultiplier uses first matching prefix', () => {
    const policy = createDefaultImportPolicy()
    policy.defaultMultiplier = 1
    policy.rules = [
      {
        id: 'claude',
        label: 'Claude',
        matchMode: 'prefix',
        pattern: 'claude',
        multiplier: 3,
      },
    ]
    expect(resolveImportMultiplier('claude-sonnet-4-6', policy)).toBe(3)
    expect(resolveImportMultiplier('gemini-3-flash', policy)).toBe(1)
  })

  test('supports ordered regex rules and per-row multiplier overrides', () => {
    const policy = createDefaultImportPolicy()
    policy.rules = [
      {
        id: 'thinking',
        label: 'Thinking',
        matchMode: 'regex',
        pattern: 'thinking$',
        multiplier: 4,
      },
      {
        id: 'claude',
        label: 'Claude',
        matchMode: 'prefix',
        pattern: 'claude',
        multiplier: 3,
      },
    ]
    policy.rowMultipliers['antigravity::claude-sonnet-4-6-thinking'] = 2.5

    expect(resolveImportMultiplier('claude-opus-thinking', policy)).toBe(4)
    expect(
      resolveImportMultiplier(
        'claude-sonnet-4-6-thinking',
        policy,
        'antigravity::claude-sonnet-4-6-thinking',
      ),
    ).toBe(2.5)
  })

  test('uses editable aliases and explicit match overrides', () => {
    const policy = createDefaultImportPolicy()
    policy.aliases.push({
      id: 'custom-claude',
      targetModel: 'custom-claude',
      sourceModels: ['claude-sonnet-4-6'],
    })
    const [aliased] = buildModelPriceImportRows({
      catalog: edgeCatalog,
      policy,
      candidates: [{ provider: 'gateway', model: 'custom-claude' }],
    })
    expect(aliased.status).toBe('matched')
    expect(aliased.matchedProviderId).toBe('anthropic')

    const [overridden] = buildModelPriceImportRows({
      catalog: edgeCatalog,
      policy,
      candidates: [{ provider: 'gateway', model: 'third-party-shared' }],
      matchOverrides: [
        {
          targetProvider: 'gateway',
          targetModel: 'third-party-shared',
          sourceProvider: 'openrouter',
          sourceModel: 'third-party-shared',
        },
      ],
    })
    expect(overridden.status).toBe('matched')
    expect(overridden.matchedProviderId).toBe('openrouter')
  })

  test('does not auto-price a unique marketplace-only match', () => {
    const catalog = parseModelsDevCatalog({
      openrouter: {
        models: {
          'marketplace-only': {
            id: 'marketplace-only',
            cost: { input: 1, output: 2 },
          },
        },
      },
    })
    const [row] = buildModelPriceImportRows({
      catalog,
      policy: createDefaultImportPolicy(),
      candidates: [{ provider: 'gateway', model: 'marketplace-only' }],
    })
    expect(row.status).toBe('unmatched')
    expect(row.final).toBeNull()
  })

  test('marks zero-cost, ambiguous, and missing-cost candidates for review', () => {
    const policy = createDefaultImportPolicy()
    const rows = buildModelPriceImportRows({
      catalog: edgeCatalog,
      policy,
      candidates: [
        { provider: 'openai', model: 'gpt-free-preview' },
        { provider: 'openai', model: 'gpt-missing-cost' },
        { provider: 'gateway', model: 'third-party-shared' },
      ],
    })

    const zero = rows.find((row) => row.homeModel === 'gpt-free-preview')
    expect(zero?.status).toBe('zero_cost')
    expect(zero?.final).toBeNull()
    expect(zero?.reasons).toContain('zero_official_cost')
    expect(isModelPriceImportRowApplicable(zero!, 'missing')).toBe(false)

    const missingCost = rows.find((row) => row.homeModel === 'gpt-missing-cost')
    expect(missingCost?.status).toBe('unmatched')
    expect(missingCost?.reasons).toContain('missing_cost')

    const ambiguous = rows.find((row) => row.homeModel === 'third-party-shared')
    expect(ambiguous?.status).toBe('ambiguous')
    expect(ambiguous?.reasons).toContain('multiple_matches')
    expect(isImportRowSelectable(ambiguous!)).toBe(false)
  })

  test('imports request-only pricing and blocks unsupported or invalid pricing', () => {
    const rows = buildModelPriceImportRows({
      catalog: edgeCatalog,
      policy: createDefaultImportPolicy(),
      candidates: [
        { provider: 'openai', model: 'gpt-request-only' },
        { provider: 'openai', model: 'gpt-image-only' },
        { provider: 'openai', model: 'gpt-negative-price' },
        { provider: 'openai', model: 'gpt-tiered-price' },
        { provider: 'openai', model: 'gpt-reasoning-price' },
      ],
    })

    const requestOnly = rows.find((row) => row.homeModel === 'gpt-request-only')
    expect(requestOnly?.status).toBe('matched')
    expect(requestOnly?.final).toMatchObject({ input: 0, output: 0, request: 0.25 })
    expect(isImportRowSelectable(requestOnly!)).toBe(true)

    const imageOnly = rows.find((row) => row.homeModel === 'gpt-image-only')
    expect(imageOnly?.status).toBe('unsupported')
    expect(imageOnly?.final).toBeNull()
    expect(imageOnly?.reasons).toContain('unsupported_price_dimensions')
    expect(isImportRowSelectable(imageOnly!)).toBe(false)

    const negative = rows.find((row) => row.homeModel === 'gpt-negative-price')
    expect(negative?.status).toBe('invalid')
    expect(negative?.final).toBeNull()
    expect(negative?.reasons).toContain('invalid_price_values')
    expect(isImportRowSelectable(negative!)).toBe(false)

    for (const model of ['gpt-tiered-price', 'gpt-reasoning-price']) {
      const unsupported = rows.find((row) => row.homeModel === model)
      expect(unsupported?.status).toBe('unsupported')
      expect(unsupported?.final).toBeNull()
      expect(unsupported?.reasons).toContain('unsupported_price_dimensions')
      expect(isImportRowSelectable(unsupported!)).toBe(false)
    }
  })

  test('does not let a zero multiplier bypass the zero-cost policy', () => {
    const policy = createDefaultImportPolicy()
    policy.defaultMultiplier = 0
    policy.rules = []

    const [blocked] = buildModelPriceImportRows({
      catalog: sampleCatalog,
      policy,
      candidates: [{ provider: 'xai', model: 'grok-4.3' }],
    })
    expect(blocked.status).toBe('zero_cost')
    expect(blocked.final).toBeNull()
    expect(blocked.reasons).toContain('zero_final_cost')
    expect(isImportRowSelectable(blocked)).toBe(false)

    policy.includeZeroCost = true
    const [allowed] = buildModelPriceImportRows({
      catalog: sampleCatalog,
      policy,
      candidates: [{ provider: 'xai', model: 'grok-4.3' }],
    })
    expect(allowed.status).toBe('zero_cost')
    expect(allowed.final).toMatchObject({ input: 0, output: 0 })
    expect(isImportRowSelectable(allowed)).toBe(true)
  })

  test('can include zero-cost rows when policy explicitly allows them', () => {
    const policy = createDefaultImportPolicy()
    policy.includeZeroCost = true
    const rows = buildModelPriceImportRows({
      catalog: edgeCatalog,
      policy,
      candidates: [{ provider: 'openai', model: 'gpt-free-preview' }],
    })

    expect(rows[0].status).toBe('zero_cost')
    expect(rows[0].final).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cacheWriteConfigured: true,
      request: 0,
    })
    expect(isModelPriceImportRowApplicable(rows[0], 'missing')).toBe(true)
  })

  test('classifies applicable rows by overwrite mode', () => {
    const policy = createDefaultImportPolicy()
    const rows = buildModelPriceImportRows({
      catalog: edgeCatalog,
      policy,
      candidates: [
        { provider: 'antigravity', model: 'gemini-3-flash-agent' },
        { provider: 'antigravity', model: 'claude-sonnet-4-6' },
        { provider: 'openai', model: 'gpt-free-preview' },
        { provider: 'openai', model: 'gpt-missing-cost' },
      ],
      existingRules: [
        {
          id: 'price-sync',
          provider: 'antigravity',
          model: 'gemini-3-flash-agent',
          serviceTier: '*',
          minInputTokens: 0,
          source: 'sync',
          enabled: true,
          inputPricePerMillion: 1,
          outputPricePerMillion: 2,
          cacheReadPricePerMillion: 0,
          cacheWritePricePerMillion: 0,
          cacheWritePriceConfigured: false,
          requestPrice: 0,
        },
        {
          id: 'price-manual',
          provider: 'antigravity',
          model: 'claude-sonnet-4-6',
          serviceTier: '*',
          minInputTokens: 0,
          source: 'manual',
          enabled: true,
          inputPricePerMillion: 9,
          outputPricePerMillion: 18,
          cacheReadPricePerMillion: 0,
          cacheWritePricePerMillion: 0,
          cacheWritePriceConfigured: false,
          requestPrice: 0,
        },
      ],
    })

    const applicableFor = (overwriteMode: 'missing' | 'sync' | 'all') =>
      rows
        .filter((row) => isModelPriceImportRowApplicable(row, overwriteMode))
        .map((row) => row.homeModel)

    expect(applicableFor('missing')).toEqual([])
    expect(applicableFor('sync')).toEqual(['gemini-3-flash-agent'])
    expect(applicableFor('all')).toEqual(['gemini-3-flash-agent', 'claude-sonnet-4-6'])
  })

  test('only treats the wildcard base band as the existing import target', () => {
    const policy = createDefaultImportPolicy()
    const [row] = buildModelPriceImportRows({
      catalog: sampleCatalog,
      policy,
      candidates: [{ provider: 'antigravity', model: 'claude-sonnet-4-6' }],
      existingRules: [
        {
          id: 'price-tier-specific',
          provider: 'antigravity',
          model: 'claude-sonnet-4-6',
          serviceTier: 'priority',
          minInputTokens: 0,
          source: 'manual',
          enabled: true,
          inputPricePerMillion: 30,
          outputPricePerMillion: 150,
          cacheReadPricePerMillion: 3,
          cacheWritePricePerMillion: 37.5,
          cacheWritePriceConfigured: true,
          requestPrice: 0,
          note: 'Priority tier override',
        },
      ],
    })

    expect(row.existing).toBeNull()
    expect(isModelPriceImportRowApplicable(row, 'missing')).toBe(true)
  })
})
