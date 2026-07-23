import { describe, expect, test } from 'bun:test'

import { readDeclaredUsageTokenBreakdownV2Capability } from '../src/lib/api/management/probe'
import {
  normalizeAggregateResponse,
  normalizeUsageOverview,
  normalizeUsageRealtimeSnapshot,
  normalizeUsageRecordsPage,
  parseUsageTokenBreakdown,
} from '../src/lib/api/management/usage-logs'

function createBreakdown(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 2,
    quality: 'complete',
    total_tokens: 39_346,
    input: {
      total_tokens: 39_320,
      uncached_tokens: 6_040,
      cache_read_tokens: 33_280,
      cache_write_tokens: 0,
    },
    output: {
      total_tokens: 26,
      non_reasoning_tokens: 26,
      reasoning_tokens: 0,
    },
    unclassified_tokens: 0,
    ...overrides,
  }
}

function createRecord(tokenBreakdown: unknown) {
  return {
    id: 'usage-1',
    usage_id: 1,
    timestamp: '2026-07-23T00:00:00Z',
    status: 'success',
    tokens: {
      input_tokens: 39_320,
      output_tokens: 26,
      reasoning_tokens: 10,
      cached_tokens: 33_280,
      cache_read_tokens: 33_280,
      cache_creation_tokens: 0,
      total_tokens: 99_999,
    },
    token_breakdown: tokenBreakdown,
    performance: { latency_ms: 100 },
    runtime: {},
  }
}

describe('token accounting v2 contract', () => {
  test('accepts the canonical mutually exclusive breakdown', () => {
    expect(parseUsageTokenBreakdown(createBreakdown())).toEqual({
      schemaVersion: 2,
      quality: 'complete',
      totalTokens: 39_346,
      input: {
        totalTokens: 39_320,
        uncachedTokens: 6_040,
        cacheReadTokens: 33_280,
        cacheWriteTokens: 0,
      },
      output: {
        totalTokens: 26,
        nonReasoningTokens: 26,
        reasoningTokens: 0,
      },
      unclassifiedTokens: 0,
    })
  })

  test('rejects negative, incomplete, and contradictory token buckets', () => {
    expect(() =>
      parseUsageTokenBreakdown(
        createBreakdown({
          input: {
            total_tokens: 39_320,
            uncached_tokens: -1,
            cache_read_tokens: 33_280,
            cache_write_tokens: 0,
          },
        }),
      ),
    ).toThrow()

    expect(() =>
      parseUsageTokenBreakdown(
        createBreakdown({
          output: {
            total_tokens: 26,
            non_reasoning_tokens: 25,
            reasoning_tokens: 0,
          },
        }),
      ),
    ).toThrow('output token buckets do not equal output.total_tokens')

    expect(() =>
      parseUsageTokenBreakdown({
        ...createBreakdown(),
        input: {
          total_tokens: 39_320,
          uncached_tokens: 6_040,
          cache_read_tokens: 33_280,
        },
      }),
    ).toThrow()
  })

  test('uses only the exact nested capability declaration', () => {
    expect(
      readDeclaredUsageTokenBreakdownV2Capability({
        capabilities: { usage_token_breakdown_v2: true },
      }),
    ).toBe(true)
    expect(readDeclaredUsageTokenBreakdownV2Capability({ usage_token_breakdown_v2: true })).toBe(
      false,
    )
    expect(
      readDeclaredUsageTokenBreakdownV2Capability({
        capabilities: { usageTokenBreakdownV2: true },
      }),
    ).toBe(false)
  })

  test('does not infer canonical tokens from legacy counters while the capability is false', () => {
    const overview = normalizeUsageOverview(
      {
        totals: {
          total_tokens: 99_999,
          token_breakdown: { schema_version: 2, total_tokens: 1 },
        },
        trend: [
          {
            bucket_start: '2026-07-23T00:00:00Z',
            bucket_end: '2026-07-23T01:00:00Z',
            total_tokens: 99_999,
            token_breakdown: { schema_version: 2, total_tokens: 1 },
          },
        ],
      },
      false,
    )

    expect(overview.totals.totalTokens).toBe(99_999)
    expect(overview.totals.tokenBreakdown).toBeNull()
    expect(overview.trend[0]?.tokenBreakdown).toBeNull()
  })

  test('parses totals, trend, records, and aggregates from token_breakdown when enabled', () => {
    const breakdown = createBreakdown()
    const overview = normalizeUsageOverview(
      {
        totals: { total_tokens: 99_999, token_breakdown: breakdown },
        trend: [
          {
            bucket_start: '2026-07-23T00:00:00Z',
            bucket_end: '2026-07-23T01:00:00Z',
            total_tokens: 99_999,
            token_breakdown: breakdown,
          },
        ],
      },
      true,
    )
    const records = normalizeUsageRecordsPage({ items: [createRecord(breakdown)] }, true)
    const aggregates = normalizeAggregateResponse(
      {
        items: [
          {
            id: 'model-a',
            label: 'model-a',
            total_tokens: 99_999,
            token_breakdown: breakdown,
          },
        ],
      },
      true,
    )

    expect(overview.totals.tokenBreakdown?.totalTokens).toBe(39_346)
    expect(overview.trend[0]?.tokenBreakdown?.input.cacheReadTokens).toBe(33_280)
    expect(records.items[0]?.tokenBreakdown?.output.nonReasoningTokens).toBe(26)
    expect(aggregates.items[0]?.tokenBreakdown?.totalTokens).toBe(39_346)
  })

  test('gates realtime token metrics on the declared capability', () => {
    const breakdown = createBreakdown()
    const response = {
      velocity: [{ bucket_start: '2026-07-23T00:00:00Z', tpm: 39_346 }],
      current_usage: [
        {
          id: 'model-a',
          label: 'model-a',
          request_count: 2,
          total_tokens: 99_999,
          token_breakdown: breakdown,
        },
      ],
    }

    const unavailable = normalizeUsageRealtimeSnapshot(response, false)
    expect(unavailable.velocity[0]?.tpm).toBeNull()
    expect(unavailable.currentUsage[0]?.totalTokens).toBeNull()
    expect(unavailable.currentUsage[0]?.tokenBreakdown).toBeNull()

    const available = normalizeUsageRealtimeSnapshot(response, true)
    expect(available.velocity[0]?.tpm).toBe(39_346)
    expect(available.currentUsage[0]?.totalTokens).toBe(39_346)
    expect(available.currentUsage[0]?.tokenBreakdown?.totalTokens).toBe(39_346)
  })

  test('preserves an invariant-safe inconsistent breakdown for total-only display', () => {
    const inconsistent = parseUsageTokenBreakdown(
      createBreakdown({
        quality: 'inconsistent',
        total_tokens: 80,
        input: {
          total_tokens: 0,
          uncached_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
        },
        output: {
          total_tokens: 0,
          non_reasoning_tokens: 0,
          reasoning_tokens: 0,
        },
        unclassified_tokens: 80,
      }),
    )

    expect(inconsistent).toMatchObject({
      quality: 'inconsistent',
      totalTokens: 80,
      unclassifiedTokens: 80,
    })
  })
})
