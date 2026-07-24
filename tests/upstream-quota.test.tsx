import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { UpstreamQuotaDetail } from '@/features/credentials/credential-detail-drawer'
import { UpstreamQuotaCell } from '@/features/upstream/quota-cells'
import {
  type UpstreamQuotaEntry,
  buildUpstreamQuotaJoinMap,
  createUpstreamQuotaCollectionBaseline,
  findCurrencyWindow,
  findUpstreamQuotaEntry,
  findXaiOnDemandWindow,
  getUpstreamQuotaAttentionCount,
  getUpstreamQuotaCollectionProgress,
  groupAntigravityQuotaWindows,
  isQuotaAttentionEntry,
  resolveAntigravityQuotaPresentation,
  resolveUpstreamQuotaCellState,
} from '@/features/upstream/upstream-quota-model'
import { normalizeUpstreamRouteSearch } from '@/features/upstream/upstream-route'
import type { QuotaCredential, QuotaWindow } from '@/lib/api/management/quota'
import '@/lib/i18n/i18n'

function createWindow(overrides: Partial<QuotaWindow> = {}): QuotaWindow {
  return {
    id: 'window-1',
    label: '5h',
    scope: 'account',
    scopeId: null,
    mode: 'rolling',
    status: 'healthy',
    unit: 'percentage',
    currency: null,
    used: 18,
    remaining: 82,
    limit: 100,
    usedRatio: 0.18,
    remainingRatio: 0.82,
    isUnlimited: false,
    resetAt: null,
    windowSeconds: 18000,
    periodUnit: 'hour',
    periodValue: 5,
    observedAt: null,
    source: 'response_header',
    ...overrides,
  }
}

function createQuotaEntry(overrides: Partial<QuotaCredential> = {}): UpstreamQuotaEntry {
  return {
    id: 'auth-01',
    name: 'auth-01',
    authIndex: 'auth-01',
    provider: 'claude',
    credentialType: 'oauth',
    account: 'ops@example.com',
    project: null,
    credentialStatus: 'enabled',
    status: 'healthy',
    freshness: 'fresh',
    source: 'response_header',
    collectionStatus: 'success',
    observedAt: null,
    expiresAt: null,
    earliestResetAt: null,
    lastAttemptAt: null,
    nextProbeAt: null,
    lastSuccessAt: null,
    consecutiveFailures: 0,
    lastError: null,
    runtime: null,
    plan: null,
    resetCredits: null,
    primaryWindows: [createWindow()],
    windowCount: 1,
    windows: [createWindow()],
    ...overrides,
  }
}

function createXaiEntry(): UpstreamQuotaEntry {
  return createQuotaEntry({
    id: 'xai-01',
    authIndex: 'xai-01',
    provider: 'xai',
    plan: { name: 'SuperGrok', premium: false },
    primaryWindows: [
      createWindow({
        id: 'xai-monthly-spend',
        label: 'Monthly Spend',
        mode: 'fixed',
        status: 'low',
        unit: 'currency',
        currency: 'USD',
        used: 108,
        remaining: 42,
        limit: 150,
        usedRatio: 0.72,
        remainingRatio: 0.28,
      }),
    ],
    windows: [
      createWindow({
        id: 'xai-monthly-spend',
        label: 'Monthly Spend',
        mode: 'fixed',
        status: 'low',
        unit: 'currency',
        currency: 'USD',
        used: 108,
        remaining: 42,
        limit: 150,
        usedRatio: 0.72,
        remainingRatio: 0.28,
      }),
      createWindow({
        id: 'xai-on-demand',
        label: 'On-Demand',
        mode: 'balance',
        status: 'healthy',
        unit: 'currency',
        currency: 'USD',
        used: 12,
        remaining: 38,
        limit: 50,
        usedRatio: 0.24,
        remainingRatio: 0.76,
      }),
    ],
    windowCount: 2,
  })
}

describe('quota join map', () => {
  test('joins by authIndex first, then id/identifier/name fallbacks', () => {
    const entry = createQuotaEntry({ id: 'auth-01', authIndex: 'auth-01' })
    const map = buildUpstreamQuotaJoinMap([entry])

    expect(
      findUpstreamQuotaEntry(map, {
        authIndex: 'AUTH-01',
        id: 'other',
        identifier: 'other',
        name: 'other',
      }),
    ).toBe(entry)
    expect(
      findUpstreamQuotaEntry(map, { authIndex: null, id: 'auth-01', identifier: '', name: '' }),
    ).toBe(entry)
    expect(
      findUpstreamQuotaEntry(map, {
        authIndex: null,
        id: 'missing',
        identifier: 'missing',
        name: 'missing',
      }),
    ).toBeNull()
  })

  test('resolves the four cell states', () => {
    const entry = createQuotaEntry()
    const map = buildUpstreamQuotaJoinMap([entry])
    const resource = { authIndex: 'auth-01', id: 'auth-01', identifier: 'auth-01', name: 'a' }

    expect(
      resolveUpstreamQuotaCellState({ available: false, loading: false, map, resource }).kind,
    ).toBe('capability-absent')
    expect(
      resolveUpstreamQuotaCellState({ available: true, loading: true, map, resource }).kind,
    ).toBe('loading')
    expect(
      resolveUpstreamQuotaCellState({ available: true, loading: false, map, resource }),
    ).toEqual({ kind: 'entry', entry })
    expect(
      resolveUpstreamQuotaCellState({
        available: true,
        loading: false,
        map,
        resource: { authIndex: 'x', id: 'x', identifier: 'x', name: 'x' },
      }).kind,
    ).toBe('not-collected')
  })
})

describe('isQuotaAttentionEntry', () => {
  test('matches backend quota, freshness, and collection degradation semantics', () => {
    expect(isQuotaAttentionEntry(createQuotaEntry())).toBe(false)
    expect(isQuotaAttentionEntry(createQuotaEntry({ status: 'low' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ status: 'exhausted' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ status: 'error' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ status: 'unknown' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ status: 'unsupported' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ freshness: 'stale' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ freshness: 'never' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ collectionStatus: 'partial' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ collectionStatus: 'failed' }))).toBe(true)
    expect(isQuotaAttentionEntry(createQuotaEntry({ collectionStatus: 'collecting' }))).toBe(false)
  })
})

describe('getUpstreamQuotaAttentionCount', () => {
  test('uses the global backend summary when the loaded page is truncated', () => {
    const entries = Array.from({ length: 200 }, (_, index) =>
      createQuotaEntry({ id: `auth-${index}`, status: index < 25 ? 'low' : 'healthy' }),
    )

    expect(getUpstreamQuotaAttentionCount(entries, { needsAttention: 250 })).toBe(250)
  })

  test('falls back to loaded entry semantics when no global summary is available', () => {
    const entries = [
      createQuotaEntry(),
      createQuotaEntry({ id: 'partial', collectionStatus: 'partial' }),
      createQuotaEntry({ id: 'stale', freshness: 'stale' }),
    ]

    expect(getUpstreamQuotaAttentionCount(entries, null)).toBe(2)
  })
})

describe('quota collection progress', () => {
  test('counts only new settled active-probe results', () => {
    const collecting = createQuotaEntry({
      id: 'auth-collecting',
      lastAttemptAt: '2026-07-22T01:00:00Z',
    })
    const passiveHeader = createQuotaEntry({
      id: 'auth-header',
      lastAttemptAt: '2026-07-22T01:00:00Z',
    })
    const activeProbe = createQuotaEntry({
      id: 'auth-active',
      lastAttemptAt: '2026-07-22T01:00:00Z',
    })
    const mixedProbe = createQuotaEntry({
      id: 'auth-mixed',
      lastAttemptAt: '2026-07-22T01:00:00Z',
    })
    const failedProbe = createQuotaEntry({
      id: 'auth-failed',
      lastAttemptAt: '2026-07-22T01:00:00Z',
    })
    const baseline = createUpstreamQuotaCollectionBaseline([
      collecting,
      passiveHeader,
      activeProbe,
      mixedProbe,
      failedProbe,
    ])

    expect(
      getUpstreamQuotaCollectionProgress(
        [
          {
            ...collecting,
            collectionStatus: 'collecting',
            lastAttemptAt: '2026-07-22T01:01:00Z',
          },
          {
            ...passiveHeader,
            source: 'response_header',
            lastAttemptAt: '2026-07-22T01:01:00Z',
          },
          {
            ...activeProbe,
            source: 'active_probe',
            lastAttemptAt: '2026-07-22T01:01:00Z',
          },
          {
            ...mixedProbe,
            source: 'mixed',
            collectionStatus: 'partial',
            lastAttemptAt: '2026-07-22T01:01:00Z',
          },
          {
            ...failedProbe,
            source: 'response_header',
            collectionStatus: 'failed',
            lastAttemptAt: '2026-07-22T01:01:00Z',
          },
        ],
        baseline,
      ),
    ).toEqual({ completedCount: 3, collectingCount: 1, candidateCount: 5 })
  })

  test('does not count unchanged, disabled, or unsupported credentials', () => {
    const unchanged = createQuotaEntry({
      id: 'auth-unchanged',
      source: 'active_probe',
      lastAttemptAt: '2026-07-22T01:00:00Z',
    })
    const disabled = createQuotaEntry({
      id: 'auth-disabled',
      credentialStatus: 'disabled',
      lastAttemptAt: '2026-07-22T01:00:00Z',
    })
    const unsupported = createQuotaEntry({
      id: 'auth-unsupported',
      status: 'unsupported',
      collectionStatus: 'unsupported',
      lastAttemptAt: '2026-07-22T01:00:00Z',
    })
    const baseline = createUpstreamQuotaCollectionBaseline([unchanged, disabled, unsupported])

    expect(
      getUpstreamQuotaCollectionProgress(
        [
          unchanged,
          {
            ...disabled,
            source: 'active_probe',
            lastAttemptAt: '2026-07-22T01:01:00Z',
          },
          {
            ...unsupported,
            source: 'active_probe',
            lastAttemptAt: '2026-07-22T01:01:00Z',
          },
        ],
        baseline,
      ),
    ).toEqual({ completedCount: 0, collectingCount: 0, candidateCount: 1 })
  })
})

describe('findCurrencyWindow', () => {
  test('finds the monthly currency window and the on-demand window separately', () => {
    const entry = createXaiEntry()
    expect(findCurrencyWindow(entry)?.id).toBe('xai-monthly-spend')
    expect(findXaiOnDemandWindow(entry)?.id).toBe('xai-on-demand')
  })

  test('returns null when the on-demand window is absent', () => {
    expect(findXaiOnDemandWindow(createQuotaEntry())).toBeNull()
  })
})

describe('Antigravity quota grouping', () => {
  test('keeps only stable scopes and orders 5-hour windows before weekly windows', () => {
    const groups = groupAntigravityQuotaWindows([
      createWindow({
        id: 'antigravity-3p-weekly',
        scopeId: 'third-party',
        periodUnit: 'week',
        periodValue: 1,
      }),
      createWindow({ id: 'antigravity-model-chat-20706', scopeId: 'chat-20706' }),
      createWindow({
        id: 'antigravity-gemini-weekly',
        scopeId: 'gemini',
        periodUnit: 'week',
        periodValue: 1,
      }),
      createWindow({ id: 'antigravity-gemini-5h', scopeId: 'gemini' }),
    ])

    expect(groups.map((group) => group.id)).toEqual(['gemini', 'third-party'])
    expect(groups[0]?.windows.map((window) => window.id)).toEqual([
      'antigravity-gemini-5h',
      'antigravity-gemini-weekly',
    ])
    expect(groups[1]?.windows.map((window) => window.id)).toEqual(['antigravity-3p-weekly'])
  })

  test('distinguishes never-collected entries from legacy snapshots', () => {
    const neverCollected = createQuotaEntry({
      provider: 'antigravity',
      status: 'unknown',
      freshness: 'never',
      collectionStatus: 'idle',
      primaryWindows: [],
      windows: [],
      windowCount: 0,
    })
    const legacy = createQuotaEntry({
      provider: 'antigravity',
      primaryWindows: [],
      windows: [],
      windowCount: 1,
    })

    expect(resolveAntigravityQuotaPresentation(neverCollected, []).kind).toBe('not-collected')
    expect(resolveAntigravityQuotaPresentation(legacy, []).kind).toBe('legacy')
  })
})

describe('UpstreamQuotaCell rendering', () => {
  test('renders grok plan and on-demand rows from real backend fields', () => {
    const entry = createXaiEntry()
    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('SuperGrok')
    expect(markup).toContain('$42.00')
    expect(markup).toContain('$150.00')
    expect(markup).toContain('$38.00')
    expect(markup).toContain('$50.00')
  })

  test('degrades to the currency window without plan or on-demand fields', () => {
    const entry = createQuotaEntry({
      id: 'xai-01',
      authIndex: 'xai-01',
      provider: 'xai',
      primaryWindows: [createXaiEntry().primaryWindows[0]!],
      windows: [],
      windowCount: 1,
    })
    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).not.toContain('SuperGrok')
    expect(markup).toContain('$42.00')
  })

  test('renders generic windows for other providers', () => {
    const markup = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'entry', entry: createQuotaEntry() }} />,
    )
    expect(markup).toContain('82%')
  })

  test('renders Codex plan and keeps account and model weekly limits distinguishable', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const accountWeekly = createWindow({
      id: 'codex-1-week',
      label: null,
      periodUnit: 'week',
      periodValue: 1,
      remainingRatio: 0.91,
    })
    const accountFiveHour = createWindow({
      id: 'codex-5-hour',
      label: null,
      periodUnit: 'hour',
      periodValue: 5,
      remainingRatio: 0.82,
    })
    const sparkWeekly = createWindow({
      id: 'codex-bengalfox-1-week',
      label: 'GPT-5.3-Codex-Spark',
      scope: 'model',
      scopeId: 'codex_bengalfox',
      periodUnit: 'week',
      periodValue: 1,
      remainingRatio: 1,
    })
    const entry = createQuotaEntry({
      provider: 'codex',
      plan: { name: 'Pro 20x', premium: true },
      primaryWindows: [accountWeekly, sparkWeekly],
      windows: [accountFiveHour, accountWeekly, sparkWeekly],
      windowCount: 3,
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Pro 20x')
    expect(markup).toContain('GPT-5.3-Codex-Spark')
    expect(markup).toContain('Weekly')
    expect(markup).toContain('91%')
    expect(markup).toContain('100%')
    expect(markup).toContain('+1 more')
  })

  test('localizes the generic Codex usage label and formats 300 minutes as 5 hours', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('zh-CN')
    const usageWindow = createWindow({
      id: 'codex-usage-5-hour',
      label: 'usage',
      scope: 'model',
      scopeId: 'codex_usage',
      periodUnit: 'minute',
      periodValue: 300,
    })
    const entry = createQuotaEntry({
      provider: 'codex',
      primaryWindows: [usageWindow],
      windows: [usageWindow],
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    await i18n.changeLanguage('en')

    expect(markup).toContain('用量')
    expect(markup).toContain('5小时')
    expect(markup).not.toContain('300分钟')
    expect(markup).not.toContain('>usage<')
  })

  test('surfaces partial collection even when the current quota status is healthy', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const entry = createQuotaEntry({ collectionStatus: 'partial' })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Healthy')
    expect(markup).toContain('Partially collected')
  })

  test('renders Antigravity Free quota as two weekly groups', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'antigravity',
      primaryWindows: [
        createWindow({
          id: 'antigravity-gemini-weekly',
          scopeId: 'gemini',
          periodUnit: 'week',
          periodValue: 1,
          remainingRatio: 0.8,
        }),
        createWindow({
          id: 'antigravity-3p-weekly',
          scopeId: 'third-party',
          periodUnit: 'week',
          periodValue: 1,
          remainingRatio: 0.6,
        }),
      ],
      windows: [],
      windowCount: 2,
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Gemini')
    expect(markup).toContain('Claude + GPT')
    expect(markup).toContain('Weekly')
    expect(markup).toContain('80%')
    expect(markup).toContain('60%')
  })

  test('renders Antigravity Pro quota with one 5-hour primary per group', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'antigravity',
      primaryWindows: [
        createWindow({
          id: 'antigravity-gemini-5h',
          scopeId: 'gemini',
          remainingRatio: 0.7,
        }),
        createWindow({
          id: 'antigravity-3p-5h',
          scopeId: 'third-party',
          remainingRatio: 0.4,
        }),
      ],
      windows: [],
      windowCount: 4,
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('5 hours')
    expect(markup).toContain('70%')
    expect(markup).toContain('40%')
    expect(markup).toContain('+2 more')
  })

  test('supports an asymmetric optional 5-hour bucket', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'antigravity',
      primaryWindows: [
        createWindow({
          id: 'antigravity-gemini-5h',
          scopeId: 'gemini',
          remainingRatio: 0.7,
        }),
        createWindow({
          id: 'antigravity-3p-weekly',
          scopeId: 'third-party',
          periodUnit: 'week',
          periodValue: 1,
          remainingRatio: 0.6,
        }),
      ],
      windows: [],
      windowCount: 3,
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('5 hours')
    expect(markup).toContain('Weekly')
    expect(markup).toContain('+1 more')
  })

  test('keeps Antigravity partial collection visible', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'antigravity',
      collectionStatus: 'partial',
      primaryWindows: [
        createWindow({
          id: 'antigravity-gemini-weekly',
          scopeId: 'gemini',
          periodUnit: 'week',
          periodValue: 1,
        }),
        createWindow({
          id: 'antigravity-3p-weekly',
          scopeId: 'third-party',
          periodUnit: 'week',
          periodValue: 1,
        }),
      ],
      windows: [],
      windowCount: 2,
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Healthy')
    expect(markup).toContain('Partially collected')
  })

  test('does not present legacy Antigravity scopes as healthy empty quota', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'antigravity',
      primaryWindows: [createWindow({ id: 'antigravity-model-chat-20706', scopeId: 'chat-20706' })],
      windows: [],
      windowCount: 1,
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Unknown')
    expect(markup).toContain('Stale')
    expect(markup).toContain('older or unrecognized format')
    expect(markup).not.toContain('Healthy')
    expect(markup).not.toContain('No quota windows')
  })

  test('shows collecting and failed Antigravity legacy upgrades explicitly', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const collecting = createQuotaEntry({
      provider: 'antigravity',
      status: 'unknown',
      freshness: 'stale',
      collectionStatus: 'collecting',
      lastAttemptAt: '2026-07-23T04:00:00Z',
      primaryWindows: [],
      windows: [],
      windowCount: 1,
    })
    const failed = createQuotaEntry({
      provider: 'antigravity',
      status: 'error',
      freshness: 'stale',
      collectionStatus: 'failed',
      lastAttemptAt: '2026-07-23T04:00:00Z',
      lastError: {
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'upgrade failed',
        retryable: true,
        occurredAt: null,
        upstreamStatusCode: null,
        requestId: null,
      },
      primaryWindows: [],
      windows: [],
      windowCount: 1,
    })

    const collectingMarkup = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'entry', entry: collecting }} />,
    )
    expect(collectingMarkup).toContain('Collecting in background')
    expect(collectingMarkup).toContain('Refreshing Antigravity quota')
    expect(collectingMarkup).not.toContain('Healthy')

    const failedMarkup = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'entry', entry: failed }} />,
    )
    expect(failedMarkup).toContain('Query failed')
    expect(failedMarkup).toContain('Collection failed')
    expect(failedMarkup).toContain('upgrade failed')
  })

  test('shows a genuinely never-collected Antigravity credential as not collected', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'antigravity',
      status: 'unknown',
      freshness: 'never',
      collectionStatus: 'idle',
      primaryWindows: [],
      windows: [],
      windowCount: 0,
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Not collected')
    expect(markup).not.toContain('older or unrecognized format')
  })

  test('renders not-collected and capability-absent states', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')

    const notCollected = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'not-collected' }} />,
    )
    expect(notCollected).toContain('Not collected')

    const absent = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'capability-absent' }} />)
    expect(absent).toContain('Unsupported')

    const loading = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'loading' }} />)
    expect(loading).toContain('data-slot="skeleton"')
  })
})

describe('UpstreamQuotaDetail rendering', () => {
  test('groups all stable Antigravity windows and ignores legacy scopes', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const item = createQuotaEntry({
      provider: 'antigravity',
      primaryWindows: [],
      windows: [
        createWindow({
          id: 'antigravity-gemini-5h',
          scopeId: 'gemini',
          remainingRatio: 0.7,
        }),
        createWindow({
          id: 'antigravity-gemini-weekly',
          scopeId: 'gemini',
          periodUnit: 'week',
          periodValue: 1,
          remainingRatio: 0.8,
        }),
        createWindow({
          id: 'antigravity-3p-5h',
          scopeId: 'third-party',
          remainingRatio: 0.4,
        }),
        createWindow({
          id: 'antigravity-3p-weekly',
          scopeId: 'third-party',
          periodUnit: 'week',
          periodValue: 1,
          remainingRatio: 0.6,
        }),
        createWindow({
          id: 'antigravity-model-chat-20706',
          scopeId: 'chat-20706',
          remainingRatio: 0.13,
        }),
      ],
      windowCount: 5,
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaDetail item={item} />)
    expect(markup).toContain('Gemini')
    expect(markup).toContain('Claude + GPT')
    expect(markup).toContain('70%')
    expect(markup).toContain('80%')
    expect(markup).toContain('40%')
    expect(markup).toContain('60%')
    expect(markup).not.toContain('13%')
  })

  test('preserves Codex plan and reset-credit detail', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')
    const item = createQuotaEntry({
      provider: 'codex',
      plan: { name: 'Pro 20x', premium: true },
      resetCredits: {
        availableCount: 2,
        observedAt: '2026-07-23T04:00:00Z',
        credits: [
          {
            status: 'available',
            grantedAt: '2026-07-22T04:00:00Z',
            expiresAt: '2026-07-29T04:00:00Z',
          },
        ],
      },
    })

    const markup = renderToStaticMarkup(<UpstreamQuotaDetail item={item} />)
    expect(markup).toContain('Pro 20x')
    expect(markup).toContain('Rate-limit reset credits')
    expect(markup).toContain('2 available')
    expect(markup).toContain('Reset credit 1')
    expect(markup).toContain('1 more reset credits')
  })
})

describe('normalizeUpstreamRouteSearch', () => {
  test('defaults to accounts and parses providers tab', () => {
    expect(normalizeUpstreamRouteSearch({}).tab).toBe('accounts')
    expect(normalizeUpstreamRouteSearch({ tab: 'providers' }).tab).toBe('providers')
    expect(normalizeUpstreamRouteSearch({ tab: 'unknown' }).tab).toBe('accounts')
  })

  test('forces accounts tab when a credential deep link is present', () => {
    const search = normalizeUpstreamRouteSearch({ tab: 'providers', credential: 'auth-01' })
    expect(search.tab).toBe('accounts')
    expect(search.credential).toBe('auth-01')
  })

  test('keeps the q filter', () => {
    expect(normalizeUpstreamRouteSearch({ q: 'kimi' }).q).toBe('kimi')
    expect(normalizeUpstreamRouteSearch({ q: '  ' }).q).toBeUndefined()
  })
})
