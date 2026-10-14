import { describe, expect, test } from 'bun:test'

import {
  normalizeRequestEventDetail,
  normalizeRequestEventsPage,
} from '../src/lib/api/management/request-events'

// Claude-style independent semantics: input_tokens is the uncached share only,
// so the canonical buckets cannot be derived from the flat counters in the UI
// (router-for-me/Home-Management-Center#186).
function createBreakdown() {
  return {
    schema_version: 2,
    quality: 'complete',
    total_tokens: 12_998,
    input: {
      total_tokens: 10_928,
      uncached_tokens: 2,
      cache_read_tokens: 10_000,
      cache_write_tokens: 926,
    },
    output: {
      total_tokens: 2_070,
      non_reasoning_tokens: 2_070,
      reasoning_tokens: 0,
    },
    unclassified_tokens: 0,
  }
}

function createEvent(tokenBreakdown: unknown) {
  return {
    id: 'evt_1',
    timestamp: '2026-10-13T00:00:00Z',
    status: 'success',
    tokens: {
      input_tokens: 2,
      output_tokens: 2_070,
      reasoning_tokens: 0,
      cached_tokens: 10_000,
      cache_read_tokens: 10_000,
      cache_creation_tokens: 926,
      total_tokens: 12_998,
    },
    token_breakdown: tokenBreakdown,
    performance: { latency_ms: 100 },
    runtime: {},
  }
}

describe('request events token breakdown', () => {
  test('keeps tokenBreakdown null while the backend capability is undeclared', () => {
    const page = normalizeRequestEventsPage({ items: [createEvent(createBreakdown())], total: 1 })
    const detail = normalizeRequestEventDetail({ event: createEvent(createBreakdown()) })

    expect(page.items[0]?.tokenBreakdown).toBeNull()
    expect(detail.event.tokenBreakdown).toBeNull()
  })

  test('parses the canonical breakdown when the capability is declared', () => {
    const page = normalizeRequestEventsPage(
      { items: [createEvent(createBreakdown())], total: 1 },
      true,
    )
    const detail = normalizeRequestEventDetail({ event: createEvent(createBreakdown()) }, true)

    expect(page.items[0]?.tokenBreakdown).toEqual({
      schemaVersion: 2,
      quality: 'complete',
      totalTokens: 12_998,
      input: {
        totalTokens: 10_928,
        uncachedTokens: 2,
        cacheReadTokens: 10_000,
        cacheWriteTokens: 926,
      },
      output: {
        totalTokens: 2_070,
        nonReasoningTokens: 2_070,
        reasoningTokens: 0,
      },
      unclassifiedTokens: 0,
    })
    expect(detail.event.tokenBreakdown?.input.cacheWriteTokens).toBe(926)
  })

  test('surfaces an inconsistent breakdown instead of deriving buckets', () => {
    const inconsistent = {
      schema_version: 2,
      quality: 'inconsistent',
      total_tokens: 537,
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
      unclassified_tokens: 537,
    }
    const detail = normalizeRequestEventDetail({ event: createEvent(inconsistent) }, true)

    expect(detail.event.tokenBreakdown).toMatchObject({
      quality: 'inconsistent',
      totalTokens: 537,
      unclassifiedTokens: 537,
    })
  })

  test('falls back to the flat counters when the breakdown payload is malformed', () => {
    const malformed = {
      ...createBreakdown(),
      input: { total_tokens: 10_928, uncached_tokens: 2, cache_read_tokens: 10_000 },
    }
    const page = normalizeRequestEventsPage({ items: [createEvent(malformed)], total: 1 }, true)
    const detail = normalizeRequestEventDetail({ event: createEvent(malformed) }, true)

    expect(page.items[0]?.tokenBreakdown).toBeNull()
    expect(detail.event.tokenBreakdown).toBeNull()
    expect(detail.event.tokens.cacheCreationTokens).toBe(926)
  })
})
