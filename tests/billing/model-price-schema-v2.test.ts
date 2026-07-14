import { describe, expect, test } from 'bun:test'

import {
  normalizeModelPriceListResponse,
  normalizePriceSnapshot,
  toModelPricePayload,
} from '../../src/lib/api/management/billing'
import { hasSeparateCacheWriteRate } from '../../src/lib/billing/cache-write-pricing'

describe('billing model price schema v2 adapter', () => {
  test('keeps collection schema version even when the list is empty', () => {
    const result = normalizeModelPriceListResponse({ price_rule_schema_version: 2, items: [] })
    expect(result.schemaVersion).toBe(2)
    expect(result.items).toEqual([])
  })

  test('keeps an empty legacy collection distinct from schema v2', () => {
    const result = normalizeModelPriceListResponse({ items: [] })
    expect(result.schemaVersion).toBeNull()
    expect(result.items).toEqual([])
  })

  test('builds unique fallback identities for multiple tier and context rules', () => {
    const result = normalizeModelPriceListResponse({
      price_rule_schema_version: 2,
      items: [
        { provider: 'openai', model: 'gpt-5.5', service_tier: '*', min_input_tokens: 0 },
        {
          provider: 'openai',
          model: 'gpt-5.5',
          service_tier: 'priority',
          min_input_tokens: 272001,
        },
      ],
    })
    expect(result.items.map((item) => item.id)).toEqual([
      'openai:gpt-5.5:*:0',
      'openai:gpt-5.5:priority:272001',
    ])
  })

  test('includes schema-v2 scope fields without the removed cache-write flag', () => {
    const v2 = toModelPricePayload({
      provider: 'openai',
      model: 'gpt-5.5',
      serviceTier: 'priority',
      minInputTokens: 272001,
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
      cacheReadPricePerMillion: 0.2,
      cacheWritePricePerMillion: 0,
      requestPrice: 0,
      enabled: true,
    })
    const legacy = toModelPricePayload({
      provider: 'openai',
      model: 'gpt-4.1',
      inputPricePerMillion: 1,
      outputPricePerMillion: 4,
      cacheReadPricePerMillion: 0,
      cacheWritePricePerMillion: 0,
      requestPrice: 0,
      enabled: true,
    })

    expect(v2).toMatchObject({
      service_tier: 'priority',
      min_input_tokens: 272001,
      cache_write_price_per_million: 0,
    })
    expect(v2).not.toHaveProperty('cache_write_price_configured')
    expect(legacy).not.toHaveProperty('service_tier')
    expect(legacy).not.toHaveProperty('min_input_tokens')
    expect(legacy).not.toHaveProperty('cache_write_price_configured')
  })

  test('keeps positive cache-write prices and ignores legacy configured flags', () => {
    const payload = toModelPricePayload({
      provider: 'openai',
      model: 'gpt-5.6',
      serviceTier: '*',
      minInputTokens: 0,
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
      cacheReadPricePerMillion: 0.2,
      cacheWritePricePerMillion: 2.5,
      requestPrice: 0,
      enabled: true,
    })
    const response = normalizeModelPriceListResponse({
      price_rule_schema_version: 2,
      items: [
        {
          id: 'price-1',
          provider: 'openai',
          model: 'gpt-5.6',
          cache_write_price_per_million: 2.5,
          cache_write_price_configured: true,
        },
      ],
    })

    expect(payload.cache_write_price_per_million).toBe(2.5)
    expect(payload).not.toHaveProperty('cache_write_price_configured')
    expect(response.items[0].cacheWritePricePerMillion).toBe(2.5)
    expect(response.items[0]).not.toHaveProperty('cacheWritePriceConfigured')
  })

  test('uses the backend positive-price boundary for separate cache-write rates', () => {
    expect(hasSeparateCacheWriteRate(0)).toBe(false)
    expect(hasSeparateCacheWriteRate(-1)).toBe(false)
    expect(hasSeparateCacheWriteRate(Number.NaN)).toBe(false)
    expect(hasSeparateCacheWriteRate(Number.POSITIVE_INFINITY)).toBe(false)
    expect(hasSeparateCacheWriteRate(0.000001)).toBe(true)
  })

  test('normalizes immutable tier, band, fallback, and token-bucket evidence', () => {
    const snapshot = normalizePriceSnapshot({
      schema_version: 2,
      provider: 'openai',
      model: 'gpt-5.5',
      service_tier: 'standard',
      min_input_tokens: 272001,
      input_price_per_million: 2,
      output_price_per_million: 8,
      cache_read_price_per_million: 0.2,
      cache_write_price_per_million: 0,
      request_price: 0,
      requested_service_tier: 'priority',
      response_service_tier: null,
      service_tier_source: 'response',
      effective_service_tier: 'priority',
      response_service_tier_fallback: true,
      input_tokens_for_band: 300000,
      token_buckets: {
        uncached_input: 299700,
        cache_read: 200,
        cache_write: 100,
        output: 1000,
      },
      cache_write_source: 'explicit',
    })

    expect(snapshot).toMatchObject({
      schemaVersion: 2,
      serviceTier: 'standard',
      minInputTokens: 272001,
      requestedServiceTier: 'priority',
      responseServiceTier: null,
      serviceTierSource: 'response',
      effectiveServiceTier: 'priority',
      responseServiceTierFallback: true,
      inputTokensForBand: 300000,
      cacheWritePricePerMillion: 0,
      tokenBuckets: {
        uncachedInput: 299700,
        cacheRead: 200,
        cacheWrite: 100,
        output: 1000,
      },
    })
  })
})
