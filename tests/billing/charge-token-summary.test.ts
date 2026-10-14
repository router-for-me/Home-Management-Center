import { describe, expect, test } from 'bun:test'

import { formatChargeTokenSummary } from '@/features/billing/billing-workbench-page'
import { formatNumber } from '@/lib/number-format'

type TFunction = Parameters<typeof formatChargeTokenSummary>[1]

function createRecorder() {
  const calls: Array<{ key: string; params: Record<string, unknown> }> = []
  const t = ((key: string, params: Record<string, unknown>) => {
    calls.push({ key, params })
    return key
  }) as TFunction
  return { t, calls }
}

// The split comes from the top-level cache_read_tokens/cache_write_tokens the
// backend fills from v2 token accounting; null means the split is unknown and
// the combined cache counter stays (router-for-me/Home-Management-Center#183).
function createRecord(cacheReadTokens: number | null, cacheWriteTokens: number | null) {
  return {
    inputTokens: 330_949,
    outputTokens: 1_161,
    cacheTokens: 328_011,
    cacheReadTokens,
    cacheWriteTokens,
  }
}

describe('charge token summary', () => {
  test('splits cache into read and write when the backend exposes the split', () => {
    const { t, calls } = createRecorder()

    formatChargeTokenSummary(createRecord(327_000, 1_011), t)

    expect(calls).toEqual([
      {
        key: 'billingPage.charges.tokenSummaryCacheSplit',
        params: {
          input: formatNumber(330_949),
          output: formatNumber(1_161),
          cacheRead: formatNumber(327_000),
          cacheWrite: formatNumber(1_011),
        },
      },
    ])
  })

  test('treats an explicit zero split as a real split', () => {
    const { t, calls } = createRecorder()

    formatChargeTokenSummary(createRecord(0, 0), t)

    expect(calls[0]?.key).toBe('billingPage.charges.tokenSummaryCacheSplit')
    expect(calls[0]?.params.cacheRead).toBe(formatNumber(0))
    expect(calls[0]?.params.cacheWrite).toBe(formatNumber(0))
  })

  test('keeps the combined cache counter when either bucket is unknown', () => {
    const { t, calls } = createRecorder()

    formatChargeTokenSummary(createRecord(null, null), t)
    formatChargeTokenSummary(createRecord(327_000, null), t)

    expect(calls).toEqual([
      {
        key: 'billingPage.charges.tokenSummary',
        params: {
          input: formatNumber(330_949),
          output: formatNumber(1_161),
          cache: formatNumber(328_011),
        },
      },
      {
        key: 'billingPage.charges.tokenSummary',
        params: {
          input: formatNumber(330_949),
          output: formatNumber(1_161),
          cache: formatNumber(328_011),
        },
      },
    ])
  })
})
