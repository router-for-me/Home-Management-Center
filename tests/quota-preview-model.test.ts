import { describe, expect, test } from 'bun:test'

import {
  buildQuotaPreviewGrid,
  getQuotaNextReset,
  needsQuotaPreviewDetail,
  resolveQuotaPreviewEntry,
} from '@/features/upstream/quota-preview-model'
import { resolveQuotaSnapshotDisplay } from '@/features/upstream/upstream-quota-model'
import { normalizeQuotaCredentialDetail, normalizeQuotaSnapshot } from '@/lib/api/management/quota'

const observed = '2026-11-05T01:00:00Z'
const later = '2026-11-05T02:00:00Z'
function window(id: string, scopeId: string | null, remaining = 0.85, weekly = false) {
  return {
    id,
    label: scopeId,
    scope: scopeId ? 'model' : 'account',
    scope_id: scopeId,
    mode: 'rolling',
    status: remaining < 0.2 ? 'low' : 'healthy',
    unit: 'percentage',
    remaining_ratio: remaining,
    period_unit: weekly ? 'week' : 'hour',
    period_value: weekly ? 1 : 5,
    observed_at: observed,
    reset_at: later,
  }
}
function entry(windows = [window('default-5h', null)], overrides: Record<string, unknown> = {}) {
  return normalizeQuotaCredentialDetail({
    credential: {
      credential_id: 'preview-01',
      provider: 'claude',
      credential_type: 'oauth',
      quota_status: 'healthy',
      freshness: 'fresh',
      collection_status: 'success',
      observed_at: observed,
      last_attempt_at: observed,
      window_count: windows.length,
      primary_windows: windows.slice(0, 2),
      ...overrides,
    },
    windows,
  })
}

describe('quota table preview selection', () => {
  test('loads missing Antigravity weekly windows from legacy list details', () => {
    const windows = [
      window('antigravity-gemini-5h', 'gemini'),
      window('antigravity-gemini-weekly', 'gemini', 0.07, true),
      window('antigravity-3p-5h', 'third-party', 1),
      window('antigravity-3p-weekly', 'third-party', 0.95, true),
    ]
    const full = entry(windows, {
      provider: 'antigravity',
      primary_windows: [windows[0], windows[2]],
    })
    const grid = buildQuotaPreviewGrid(full)!
    expect(grid.groups.map((g) => g.id)).toEqual(['gemini', 'third-party'])
    expect(grid.periods.map((p) => p.periodUnit)).toEqual(['hour', 'week'])
    expect(grid.groups.map((g) => g.values.map((w) => w?.remainingRatio))).toEqual([
      [0.85, 0.07],
      [1, 0.95],
    ])
    expect(needsQuotaPreviewDetail(full)).toBe(false)
    const list = { ...full, windows: [] }
    expect(needsQuotaPreviewDetail(list)).toBe(true)
    const pending = buildQuotaPreviewGrid(list)!
    expect(pending.periods.map((p) => p.periodUnit)).toEqual(['hour'])
    expect(pending.groups.map((g) => g.values.map((w) => w?.remainingRatio))).toEqual([[0.85], [1]])
    const resolved = resolveQuotaPreviewEntry(list, full)
    expect(needsQuotaPreviewDetail(resolved)).toBe(false)
    expect(buildQuotaPreviewGrid(resolved)).toEqual(grid)
  })

  const antigravityWindows = [
    window('antigravity-gemini-5h', 'gemini'),
    window('antigravity-3p-5h', 'third-party', 1),
    window('antigravity-gemini-weekly', 'gemini', 0.07, true),
    window('antigravity-3p-weekly', 'third-party', 0.95, true),
  ]
  for (const scenario of [
    {
      name: 'all four windows',
      indexes: [0, 1, 2, 3],
      periods: ['hour', 'week'],
      values: [
        [0.85, 0.07],
        [1, 0.95],
      ],
    },
    {
      name: 'weekly-only windows',
      indexes: [2, 3],
      periods: ['week'],
      values: [[0.07], [0.95]],
    },
    {
      name: 'no third-party five-hour window',
      indexes: [0, 2, 3],
      periods: ['hour', 'week'],
      values: [
        [0.85, 0.07],
        [null, 0.95],
      ],
    },
    {
      name: 'no Gemini five-hour window',
      indexes: [1, 2, 3],
      periods: ['hour', 'week'],
      values: [
        [null, 0.07],
        [1, 0.95],
      ],
    },
  ]) {
    test(`renders Antigravity list with ${scenario.name} without requesting details`, () => {
      const primaryWindows = scenario.indexes.map((index) => antigravityWindows[index])
      const list = normalizeQuotaSnapshot({
        items: [
          {
            credential_id: 'antigravity-preview',
            provider: 'antigravity',
            quota_status: 'low',
            window_count: primaryWindows.length,
            primary_windows: primaryWindows,
          },
        ],
      }).items[0]!

      expect(list.windows).toEqual([])
      expect(needsQuotaPreviewDetail(list)).toBe(false)
      const grid = buildQuotaPreviewGrid(list)!
      expect(grid.groups.map((group) => group.id)).toEqual(['gemini', 'third-party'])
      expect(grid.periods.map((period) => period.periodUnit)).toEqual(scenario.periods)
      expect(
        grid.groups.map((group) => group.values.map((value) => value?.remainingRatio ?? null)),
      ).toEqual(scenario.values)
    })
  }

  test('keeps Codex account and Spark families separate, including their missing periods', () => {
    const windows = [
      window('codex-5h', null),
      window('codex-week', null, 0.31, true),
      window('codex-spark-week', 'codex_bengalfox', 1, true),
      window('review-week', 'code_review', 0.1, true),
    ]
    const full = entry(windows, { provider: 'codex', primary_windows: [windows[1], windows[2]] })
    const grid = buildQuotaPreviewGrid(full)!
    expect(grid.groups).toHaveLength(2)
    expect(grid.groups[0]!.values.map((w) => w?.id)).toEqual(['codex-5h', 'codex-week'])
    expect(grid.groups[1]!.values.map((w) => w?.id ?? null)).toEqual([null, 'codex-spark-week'])
    expect(grid.groups.some((g) => g.id.includes('code_review'))).toBe(false)
  })

  test('caps a large model set at two groups and two structured periods', () => {
    const windows = Array.from({ length: 12 }, (_, n) => window('model-' + n, 'model-' + n))
    const grid = buildQuotaPreviewGrid(entry(windows, { primary_windows: windows }))!
    expect(grid.groups).toHaveLength(2)
    expect(grid.groups.flatMap((g) => g.values).filter(Boolean)).toHaveLength(2)
    expect(grid.groups.map((g) => g.representative.scopeId)).toEqual(['model-0', 'model-1'])
  })

  test('combines equivalent minute and hour periods without guessing from labels', () => {
    const first = window('5h', null)
    const minutes = { ...window('300m', null), period_unit: 'minute', period_value: 300 }
    const weekly = window('week', null, 0.31, true)
    expect(buildQuotaPreviewGrid(entry([first, minutes, weekly]))!.periods).toHaveLength(2)
    expect(
      buildQuotaPreviewGrid(
        entry([{ ...first, label: '5h', period_unit: 'unknown', period_value: null }]),
      ),
    ).toBeNull()
  })

  test('does not request details for unsupported, empty or already complete previews', () => {
    const full = entry()
    expect(needsQuotaPreviewDetail(full)).toBe(false)
    expect(needsQuotaPreviewDetail(entry([], { window_count: 10 }))).toBe(false)
    expect(needsQuotaPreviewDetail({ ...full, status: 'unsupported', windowCount: 10 })).toBe(false)
  })
})

describe('quota data freshness and cache ordering', () => {
  test('uses backend freshness independently of collection failure and elapsed hours', () => {
    const fresh = entry(undefined, {
      observed_at: '2026-11-04T00:00:00Z',
      collection_status: 'failed',
    })
    expect(resolveQuotaSnapshotDisplay(fresh).historical).toBe(false)
    expect(
      resolveQuotaSnapshotDisplay({ ...fresh, expiresAt: '2026-01-01T00:00:00Z' }).historical,
    ).toBe(true)
    expect(
      resolveQuotaSnapshotDisplay({ ...fresh, freshness: 'stale', collectionStatus: 'success' })
        .historical,
    ).toBe(true)
  })

  test('rejects detail windows older than a new list observation or attempt', () => {
    const old = entry()
    const newObservation = { ...old, observedAt: later }
    const newAttempt = { ...old, lastAttemptAt: later }
    expect(resolveQuotaPreviewEntry(newObservation, old)).toBe(newObservation)
    expect(resolveQuotaPreviewEntry(newAttempt, old)).toBe(newAttempt)
    expect(resolveQuotaPreviewEntry(old, newObservation)).toBe(newObservation)
  })

  test('does not cross credential identities or revert a settled attempt to collecting', () => {
    const current = entry()
    expect(resolveQuotaPreviewEntry(current, { ...current, provider: 'codex' })).toBe(current)
    expect(resolveQuotaPreviewEntry(current, { ...current, id: 'other' })).toBe(current)
    expect(
      resolveQuotaPreviewEntry(current, { ...current, credentialType: 'provider_api_key' }),
    ).toBe(current)
    expect(resolveQuotaPreviewEntry(current, { ...current, collectionStatus: 'collecting' })).toBe(
      current,
    )
    expect(resolveQuotaPreviewEntry(current, null)).toBe(current)
  })

  test('does not let cached detail freshness override the list expiry for the same observation', () => {
    const cached = entry()
    const list = { ...cached, freshness: 'stale' as const, windows: [] }
    const merged = resolveQuotaPreviewEntry(list, cached)
    expect(merged.freshness).toBe('stale')
    expect(merged.windows).toEqual(cached.windows)
    expect(resolveQuotaSnapshotDisplay(merged).historical).toBe(true)
  })
})

describe('quota reset disclosure', () => {
  test('honors the backend reset across periods omitted from the preview', () => {
    expect(getQuotaNextReset(entry(undefined, { earliest_reset_at: '2026-11-05T01:30:00Z' }))).toBe(
      '2026-11-05T01:30:00Z',
    )
  })

  test('keeps past resets as recorded instead of inventing a new cycle boundary', () => {
    const past = '2026-11-01T00:00:00Z'
    const snapshot = entry([
      { ...window('week', null), reset_at: later },
      { ...window('5h', null), reset_at: past },
    ])
    expect(getQuotaNextReset(snapshot)).toBe(past)
    expect(
      getQuotaNextReset(entry([{ ...window('unknown-reset', null), reset_at: 'invalid' }])),
    ).toBeNull()
  })
})
