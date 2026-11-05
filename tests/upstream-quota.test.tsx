import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { TooltipProvider } from '@/components/ui/tooltip'
import {
  GrokQuotaDetail,
  UpstreamQuotaDetail,
} from '@/features/credentials/credential-detail-drawer'
import { QuotaSnapshotBadges, UpstreamQuotaCell } from '@/features/upstream/quota-cells'
import { getUpstreamQuotaErrorSummary } from '@/features/upstream/quota-format'
import {
  type UpstreamQuotaEntry,
  buildUpstreamQuotaJoinMap,
  countUpstreamQuotaAttentionResources,
  createUpstreamQuotaCollectionBaseline,
  findCurrencyWindow,
  findUpstreamQuotaEntry,
  findXaiOnDemandWindow,
  findXaiWeeklyWindow,
  getUpstreamQuotaCollectionProgress,
  groupAntigravityQuotaWindows,
  isCredentialQuotaCollectable,
  isQuotaAttentionEntry,
  resolveAntigravityQuotaPresentation,
  resolveCredentialQuotaAction,
  resolveQuotaLabelState,
  resolveUpstreamQuotaCellState,
} from '@/features/upstream/upstream-quota-model'
import { normalizeUpstreamRouteSearch } from '@/features/upstream/upstream-route'
import type { QuotaCredential, QuotaWindow } from '@/lib/api/management/quota'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    resources: { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ru },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
})

function renderWithI18n(node: React.ReactElement) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <TooltipProvider>{node}</TooltipProvider>
    </I18nextProvider>,
  )
}

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

function createXaiWeeklyWindow(overrides: Partial<QuotaWindow> = {}): QuotaWindow {
  return createWindow({
    id: 'xai-weekly-usage',
    label: 'Weekly Limit',
    mode: 'fixed',
    status: 'healthy',
    unit: 'percentage',
    used: 16,
    remaining: 84,
    limit: 100,
    usedRatio: 0.16,
    remainingRatio: 0.84,
    periodUnit: 'week',
    periodValue: 1,
    resetAt: '2026-10-16T20:46:00Z',
    ...overrides,
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
      resolveUpstreamQuotaCellState({
        available: false,
        loading: false,
        truncated: false,
        map,
        resource,
      }).kind,
    ).toBe('capability-absent')
    expect(
      resolveUpstreamQuotaCellState({
        available: true,
        loading: true,
        truncated: false,
        map: new Map(),
        resource,
      }).kind,
    ).toBe('loading')
    expect(
      resolveUpstreamQuotaCellState({
        available: true,
        loading: false,
        truncated: false,
        map,
        resource,
      }),
    ).toEqual({ kind: 'entry', entry })
    expect(
      resolveUpstreamQuotaCellState({
        available: true,
        loading: false,
        truncated: false,
        map,
        resource: { authIndex: 'x', id: 'x', identifier: 'x', name: 'x' },
      }).kind,
    ).toBe('not-collected')
    // Past the fetched risk-sorted page: not "never collected", just not loaded.
    expect(
      resolveUpstreamQuotaCellState({
        available: true,
        loading: false,
        truncated: true,
        map,
        resource: { authIndex: 'x', id: 'x', identifier: 'x', name: 'x' },
      }).kind,
    ).toBe('snapshot-miss')
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

describe('countUpstreamQuotaAttentionResources', () => {
  test('counts only attention entries that join to credential resources', () => {
    const entries = [
      createQuotaEntry({ id: 'oauth-low', authIndex: 'oauth-low', status: 'low' }),
      createQuotaEntry({ id: 'oauth-ok', authIndex: 'oauth-ok' }),
      createQuotaEntry({
        id: 'key-unsupported',
        authIndex: 'key-unsupported',
        status: 'unsupported',
      }),
    ]
    const map = buildUpstreamQuotaJoinMap(entries)
    const resources = [
      {
        authIndex: 'oauth-low',
        id: 'claude:oauth-low',
        identifier: 'oauth-low',
        name: 'oauth-low',
      },
      { authIndex: 'oauth-ok', id: 'claude:oauth-ok', identifier: 'oauth-ok', name: 'oauth-ok' },
    ]

    expect(countUpstreamQuotaAttentionResources(resources, map)).toBe(1)
  })

  test('returns zero when attention entries never join the credential list', () => {
    // Regression: the backend global summary spans non-OAuth auths (provider
    // API keys, file auth) that /auth-files never displays, so the card count
    // must come from the same join the attention filter uses.
    const map = buildUpstreamQuotaJoinMap([
      createQuotaEntry({ id: 'key-1', authIndex: 'key-1', status: 'unsupported' }),
      createQuotaEntry({ id: 'key-2', authIndex: 'key-2', status: 'unsupported' }),
    ])
    const resources = [
      { authIndex: 'oauth-ok', id: 'claude:oauth-ok', identifier: 'oauth-ok', name: 'oauth-ok' },
    ]

    expect(countUpstreamQuotaAttentionResources(resources, map)).toBe(0)
  })

  test('ignores resources without a quota entry', () => {
    const resources = [
      { authIndex: 'oauth-ok', id: 'claude:oauth-ok', identifier: 'oauth-ok', name: 'oauth-ok' },
    ]

    expect(countUpstreamQuotaAttentionResources(resources, new Map())).toBe(0)
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

  test('finds the weekly usage window when present', () => {
    const entry = createQuotaEntry({
      provider: 'xai',
      primaryWindows: [createXaiWeeklyWindow()],
      windows: [createXaiWeeklyWindow()],
    })
    expect(findXaiWeeklyWindow(entry)?.id).toBe('xai-weekly-usage')
    expect(findXaiWeeklyWindow(createXaiEntry())).toBeNull()
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
    const entry: UpstreamQuotaEntry = {
      ...createXaiEntry(),
      observedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    }
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('SuperGrok')
    expect(markup).toContain('$42.00')
    expect(markup).toContain('$150.00')
    expect(markup).toContain('$38.00')
    expect(markup).toContain('$50.00')
    expect(markup).toContain('Collected 5 min. ago')
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
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).not.toContain('SuperGrok')
    expect(markup).toContain('$42.00')
  })

  test('renders the weekly limit with a disabled on-demand row when only the weekly window exists', () => {
    const weekly = createXaiWeeklyWindow()
    const productWindow = createWindow({
      id: 'xai-product-grokbuild',
      label: 'GrokBuild',
      scope: 'account',
      scopeId: 'xai-product-usage',
      mode: 'fixed',
      status: 'healthy',
      unit: 'percentage',
      used: 1,
      remaining: 99,
      limit: 100,
      usedRatio: 0.01,
      remainingRatio: 0.99,
      periodUnit: 'week',
      periodValue: 1,
      priority: 20,
    })
    const entry = createQuotaEntry({
      id: 'xai-01',
      authIndex: 'xai-01',
      provider: 'xai',
      plan: { name: 'SuperGrok', premium: false },
      primaryWindows: [weekly, productWindow],
      windows: [weekly, productWindow],
      windowCount: 2,
    })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('SuperGrok')
    expect(markup).toContain('Weekly limit')
    expect(markup).toContain('84%')
    expect(markup).toContain('Products sharing quota: 1')
    const detail = renderWithI18n(<GrokQuotaDetail entry={entry} />)
    expect(detail).toContain('Usage breakdown (shared quota)')
    expect(detail).toContain('GrokBuild usage')
    expect(detail).toContain('GrokBuild usage')
    expect(detail).toContain('1%')
    expect(markup).toContain('On-demand')
    expect(markup).toContain('Disabled')
    expect(markup).not.toContain('Monthly')
  })

  test('marks on-demand as disabled when the monthly window exists without an on-demand window', () => {
    const monthly = createXaiEntry().primaryWindows[0]!
    const entry = createQuotaEntry({
      id: 'xai-01',
      authIndex: 'xai-01',
      provider: 'xai',
      primaryWindows: [monthly],
      windows: [monthly],
      windowCount: 1,
    })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Monthly')
    expect(markup).toContain('On-demand')
    expect(markup).toContain('Disabled')
  })

  test('renders the weekly limit before the monthly row when all xAI windows exist', () => {
    const base = createXaiEntry()
    const weekly = createXaiWeeklyWindow()
    const entry: UpstreamQuotaEntry = {
      ...base,
      primaryWindows: [weekly, ...base.primaryWindows],
      windows: [weekly, ...base.windows],
      windowCount: 3,
    }
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    const weeklyIndex = markup.indexOf('Weekly limit')
    const monthlyIndex = markup.indexOf('Monthly')
    expect(weeklyIndex).toBeGreaterThan(-1)
    expect(monthlyIndex).toBeGreaterThan(-1)
    expect(weeklyIndex).toBeLessThan(monthlyIndex)
    expect(markup).not.toContain('Disabled')
  })

  test('renders generic windows for other providers', () => {
    const markup = renderWithI18n(
      <UpstreamQuotaCell state={{ kind: 'entry', entry: createQuotaEntry() }} />,
    )
    expect(markup).toContain('82%')
  })

  test('marks meta and muse credentials as quota collectable and renders Meta plan and windows (#197)', async () => {
    await testI18n.changeLanguage('en')
    expect(
      isCredentialQuotaCollectable({ provider: 'meta', disabled: false, status: 'active' }),
    ).toBe(true)
    expect(
      isCredentialQuotaCollectable({ provider: 'muse', disabled: false, status: 'active' }),
    ).toBe(true)

    const metaWindow = createWindow({
      id: 'meta-window',
      label: 'Window',
      periodUnit: 'hour',
      periodValue: 5,
      remainingRatio: 0.98,
    })
    const metaWeekly = createWindow({
      id: 'meta-weekly',
      label: 'Weekly limit',
      periodUnit: 'week',
      periodValue: 1,
      remainingRatio: 0.75,
    })
    const entry = createQuotaEntry({
      id: 'meta-01',
      authIndex: 'meta-01',
      provider: 'meta',
      plan: { name: 'Muse Code Everyday Usage', premium: false },
      primaryWindows: [metaWindow, metaWeekly],
      windows: [metaWindow, metaWeekly],
      windowCount: 2,
    })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Muse Code Everyday Usage')
    expect(markup).toContain('5 hours')
    expect(markup).toContain('98%')
    expect(markup).toContain('Weekly')
    expect(markup).toContain('75%')
  })

  test('renders Codex plan and keeps account and model weekly limits distinguishable', async () => {
    await testI18n.changeLanguage('en')
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

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Pro 20x')
    expect(markup).toContain('GPT-5.3-Codex-Spark')
    expect(markup).toContain('Weekly')
    expect(markup).toContain('91%')
    expect(markup).toContain('100%')
    expect(markup).toContain('82%')
    expect(markup.match(/role="progressbar"/g)).toHaveLength(3)
  })

  test('localizes the generic Codex usage label and formats 300 minutes as 5 hours', async () => {
    await testI18n.changeLanguage('zh-CN')
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

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    await testI18n.changeLanguage('en')

    expect(markup).toContain('用量')
    expect(markup).toContain('5小时')
    expect(markup).not.toContain('300分钟')
    expect(markup).not.toContain('>usage<')
  })

  test('surfaces partial collection even when the current quota status is healthy', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({ collectionStatus: 'partial' })

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).not.toContain('Quota healthy')
    expect(markup).toContain('Partial collection')
  })

  test('renders Antigravity Free quota as two weekly groups', async () => {
    await testI18n.changeLanguage('en')
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

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Gemini')
    expect(markup).toContain('Claude + GPT')
    expect(markup).toContain('Weekly')
    expect(markup).toContain('80%')
    expect(markup).toContain('60%')
  })

  test('renders Antigravity Pro quota with one 5-hour primary per group', async () => {
    await testI18n.changeLanguage('en')
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

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('5 hours')
    expect(markup).toContain('70%')
    expect(markup).toContain('40%')
    expect(markup.match(/role="progressbar"/g)).toHaveLength(2)
  })

  test('supports an asymmetric optional 5-hour bucket', async () => {
    await testI18n.changeLanguage('en')
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

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('5 hours')
    expect(markup).toContain('Weekly')
    expect(markup.match(/role="progressbar"/g)).toHaveLength(2)
  })

  test('keeps Antigravity partial collection visible', async () => {
    await testI18n.changeLanguage('en')
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

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).not.toContain('Quota healthy')
    expect(markup).toContain('Partial collection')
  })

  test('does not present legacy Antigravity scopes as healthy empty quota', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'antigravity',
      primaryWindows: [createWindow({ id: 'antigravity-model-chat-20706', scopeId: 'chat-20706' })],
      windows: [],
      windowCount: 1,
    })

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Recollect needed')
    expect(markup).not.toContain('Quota healthy')
    expect(markup).not.toContain('No quota windows')
  })

  test('shows collecting and failed Antigravity legacy upgrades explicitly', async () => {
    await testI18n.changeLanguage('en')
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

    const collectingMarkup = renderWithI18n(
      <UpstreamQuotaCell state={{ kind: 'entry', entry: collecting }} />,
    )
    expect(collectingMarkup).toContain('Collecting')
    expect(collectingMarkup).not.toContain('Healthy')

    const failedMarkup = renderWithI18n(
      <UpstreamQuotaCell state={{ kind: 'entry', entry: failed }} />,
    )
    expect(failedMarkup).toContain('Quota query failed')
    expect(failedMarkup).not.toContain('upgrade failed')
  })

  test('shows a genuinely never-collected Antigravity credential as not collected', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'antigravity',
      status: 'unknown',
      freshness: 'never',
      collectionStatus: 'idle',
      primaryWindows: [],
      windows: [],
      windowCount: 0,
    })

    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Not collected')
    expect(markup).not.toContain('older or unrecognized format')
  })

  test('renders not-collected and capability-absent states', async () => {
    await testI18n.changeLanguage('en')

    const notCollected = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'not-collected' }} />)
    expect(notCollected).toContain('No quota record')

    const absent = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'capability-absent' }} />)
    expect(absent).toContain('Query unsupported')

    const loading = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'loading' }} />)
    expect(loading).toContain('data-slot="skeleton"')
  })
})

describe('quota summary hierarchy', () => {
  test.each(['healthy', 'low', 'exhausted'] as const)(
    'does not duplicate %s quota levels in the labels row',
    async (status) => {
      await testI18n.changeLanguage('en')
      const entry = createQuotaEntry({ status, plan: { name: 'Pro', premium: false } })
      expect(resolveQuotaLabelState(entry)).toBeNull()
      const labels = renderWithI18n(<QuotaSnapshotBadges entry={entry} />)
      expect(labels).toContain('Pro plan')
      expect(labels).not.toContain('<svg')
      expect(labels).not.toContain('Quota healthy')
      expect(labels).not.toContain('Quota low')
      expect(labels).not.toContain('Quota exhausted')
      expect(renderWithI18n(<QuotaSnapshotBadges entry={{ ...entry, plan: null }} />)).toBe('')
    },
  )

  test('chooses one exceptional label even when collection, failure and staleness overlap', () => {
    const failed = createQuotaEntry({ collectionStatus: 'failed', freshness: 'stale' })
    expect(resolveQuotaLabelState(failed)).toBe('failed')
    expect(resolveQuotaLabelState(failed, { collecting: true })).toBe('collecting')
    expect(resolveQuotaLabelState({ ...failed, status: 'unsupported' }, { collecting: true })).toBe(
      'unsupported',
    )
    expect(resolveQuotaLabelState({ ...failed, collectionStatus: 'partial' })).toBe('partial')
    expect(resolveQuotaLabelState(failed, { readFailed: true })).toBe('read-error')
  })

  test('does not describe a failed record read as a credential that has never been collected', async () => {
    await testI18n.changeLanguage('en')
    const state = resolveUpstreamQuotaCellState({
      available: true,
      loading: false,
      truncated: false,
      readFailed: true,
      map: new Map(),
      resource: { id: 'auth-01', authIndex: 'auth-01', identifier: 'auth-01', name: 'auth-01' },
    })
    expect(state.kind).toBe('read-error')
    const markup = renderWithI18n(<UpstreamQuotaCell state={state} />)
    expect(markup).toContain('Quota read failed')
    expect(markup).not.toContain('Not collected')
    expect(markup).not.toContain('role="progressbar"')
  })

  test('keeps unknown reset time independent from a valid collection', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({
      observedAt: new Date(Date.now() - 300_000).toISOString(),
      expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Reset time unknown')
    expect(markup).toContain('Collected 5 min. ago')
    expect(markup).not.toContain('Recollect needed')
  })

  test('requests a new collection without discarding a known future reset time', async () => {
    await testI18n.changeLanguage('en')
    const window = createWindow({ resetAt: new Date(Date.now() + 7_200_000).toISOString() })
    const entry = createQuotaEntry({
      primaryWindows: [window],
      windows: [window],
      observedAt: new Date(Date.now() - 39_600_000).toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('Recollect needed')
    expect(markup).toContain('Resets ')
    expect(markup).not.toContain('Reset time unknown')
  })

  test('distinguishes a first collection from an attempted collection with no result', async () => {
    await testI18n.changeLanguage('en')
    const never = createQuotaEntry({
      status: 'unknown',
      freshness: 'never',
      observedAt: null,
      lastAttemptAt: null,
      primaryWindows: [],
      windows: [],
      windowCount: 0,
    })
    const first = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry: never }} />)
    expect(first).toContain('Not collected yet')
    expect(first).toContain('Reset time unknown')
    expect(first).not.toContain('role="progressbar"')
    const attempted = renderWithI18n(
      <UpstreamQuotaCell
        state={{
          kind: 'entry',
          entry: { ...never, collectionStatus: 'failed', lastAttemptAt: new Date().toISOString() },
        }}
      />,
    )
    expect(attempted).toContain('Quota query failed')
    expect(attempted).toContain('No collection result')
    expect(attempted).not.toContain('Not collected yet')
  })

  test('keeps the collection timestamp concise when displayed values have expired', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({
      freshness: 'stale',
      observedAt: new Date(Date.now() - 39_600_000).toISOString(),
    })
    const markup = renderWithI18n(
      <UpstreamQuotaCell
        state={{ kind: 'entry', entry }}
        unavailableReason="Active collection is unavailable on this backend."
      />,
    )
    const timeLabel = markup.match(/<time\b[^>]*aria-label="([^"]*)"/)?.[1]
    expect(timeLabel).toContain('Collected at:')
    expect(timeLabel).not.toContain('validity period')
    expect(timeLabel).not.toContain('Active collection is unavailable')
  })

  test('keeps a hidden exhausted window discoverable after removing quota-level labels', async () => {
    await testI18n.changeLanguage('en')
    const windows = [
      createWindow({ id: 'visible-1', scope: 'model', scopeId: 'model-1' }),
      createWindow({ id: 'visible-2', scope: 'model', scopeId: 'model-2' }),
      createWindow({
        id: 'hidden',
        scope: 'model',
        scopeId: 'model-3',
        status: 'exhausted',
        remainingRatio: 0,
      }),
    ]
    const entry = createQuotaEntry({
      status: 'exhausted',
      primaryWindows: windows.slice(0, 2),
      windows,
      windowCount: 3,
    })
    const markup = renderWithI18n(
      <UpstreamQuotaCell state={{ kind: 'entry', entry }} onInspect={() => undefined} />,
    )
    expect(markup.match(/role="progressbar"/g)).toHaveLength(2)
    expect(markup).toContain('Another quota window is exhausted')
    expect(markup).toContain('Quota details (3 windows)')
  })

  test('caps a large model collection at two preview bars with an actionable total', async () => {
    await testI18n.changeLanguage('en')
    const windows = Array.from({ length: 10 }, (_, index) =>
      createWindow({
        id: `model-${index}`,
        scope: 'model',
        scopeId: `model-${index}`,
        label: `Model ${index}`,
      }),
    )
    const entry = createQuotaEntry({
      primaryWindows: windows.slice(0, 2),
      windows,
      windowCount: 10,
    })
    const markup = renderWithI18n(
      <UpstreamQuotaCell state={{ kind: 'entry', entry }} onInspect={() => undefined} />,
    )
    expect(markup.match(/role="progressbar"/g)).toHaveLength(2)
    expect(markup).toContain('aria-label="Quota details (10 windows)"')
    expect(markup).toContain('<button')
    expect(markup).toContain('Model 0')
    expect(markup).toContain('Model 1')
    expect(markup).not.toContain('Model 2')
    expect(markup).not.toContain('+8 more')
  })

  test('caps xAI at two bars even when weekly, monthly and on-demand windows exist', async () => {
    await testI18n.changeLanguage('en')
    const entry = createXaiEntry()
    entry.windows.unshift(createXaiWeeklyWindow())
    entry.windowCount = 3
    const markup = renderWithI18n(
      <UpstreamQuotaCell state={{ kind: 'entry', entry }} onInspect={() => undefined} />,
    )
    expect(markup.match(/role="progressbar"/g)).toHaveLength(2)
    expect(markup).toContain('aria-label="Quota details (3 windows)"')
    expect(markup).toContain('On-demand: Enabled')
  })

  test('shows five-hour and constrained weekly quotas together without hiding either', async () => {
    await testI18n.changeLanguage('en')
    const fiveHour = createWindow({
      id: 'antigravity-gemini-5h',
      scopeId: 'gemini',
      remainingRatio: 0.88,
    })
    const weekly = createWindow({
      id: 'antigravity-gemini-weekly',
      scopeId: 'gemini',
      status: 'low',
      periodUnit: 'week',
      periodValue: 1,
      remainingRatio: 0.12,
    })
    const thirdParty = createWindow({
      id: 'antigravity-3p-5h',
      scopeId: 'third-party',
      remainingRatio: 1,
    })
    const entry = createQuotaEntry({
      provider: 'antigravity',
      status: 'low',
      primaryWindows: [fiveHour, thirdParty],
      windows: [fiveHour, weekly, thirdParty],
      windowCount: 3,
    })
    const markup = renderWithI18n(
      <UpstreamQuotaCell state={{ kind: 'entry', entry }} onInspect={() => undefined} />,
    )
    expect(markup.match(/role="progressbar"/g)).toHaveLength(3)
    expect(markup).toContain('12%')
    expect(markup).toContain('100%')
    expect(markup).toContain('88%')
    expect(markup).toContain('Weekly')
  })

  test('distinguishes old quota data from its independently presented plan', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({ freshness: 'stale', plan: { name: 'Ultra', premium: true } })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(resolveQuotaLabelState(entry)).toBe('outdated')
    expect(markup).toContain('Recollect needed')
    expect(markup).not.toContain('Quota healthy')
    expect(markup.indexOf('Ultra plan')).toBeLessThan(markup.indexOf('Recollect needed'))
    const noData = renderWithI18n(
      <UpstreamQuotaCell
        state={{
          kind: 'entry',
          entry: createQuotaEntry({
            status: 'unknown',
            windows: [],
            primaryWindows: [],
            windowCount: 0,
          }),
        }}
      />,
    )
    expect(noData).toContain('No data yet')
    expect(noData).not.toContain('Recollect needed')
  })

  test('retains fresh values after a failed refresh without invalidating freshness or exposing raw errors', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({
      collectionStatus: 'failed',
      lastError: {
        code: 'UPSTREAM_AUTH_REJECTED',
        message: 'Upstream rejected the credential.',
        retryable: true,
        occurredAt: null,
        upstreamStatusCode: 401,
        requestId: null,
      },
    })
    const markup = renderWithI18n(
      <UpstreamQuotaCell state={{ kind: 'entry', entry }} onInspect={() => undefined} />,
    )
    expect(markup).not.toContain('Recollect needed')
    expect(markup).toContain('82%')
    expect(markup).toContain('Quota query failed')
    expect(markup).toContain('Quota query failed. Show explanation')
    expect(markup).not.toContain(entry.lastError!.message)
    expect(markup).not.toContain('Quota healthy')
    const detail = renderWithI18n(<UpstreamQuotaDetail item={entry} />)
    expect(detail.indexOf('Quota query unauthorized')).toBeLessThan(
      detail.indexOf('role="progressbar"'),
    )
    expect(detail).toContain('This describes the quota query only, not the outcome of model calls.')
    expect(detail).toContain('Technical details')
  })

  test('uses structured errors rather than guessing the meaning of raw error text', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({
      lastError: {
        code: 'NEW_CODE',
        message: 'Upstream rejected the credential.',
        retryable: true,
        occurredAt: null,
        upstreamStatusCode: null,
        requestId: null,
      },
    })
    expect(getUpstreamQuotaErrorSummary(entry, testI18n.t).title).toBe('Quota query failed')
    entry.lastError!.upstreamStatusCode = 429
    expect(getUpstreamQuotaErrorSummary(entry, testI18n.t).title).toBe('Quota query rate limited')
  })

  test('does not announce an unavailable percentage as zero', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({
      primaryWindows: [createWindow({ remainingRatio: null })],
      windows: [],
    })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('aria-valuetext="Not available"')
    expect(markup).not.toContain('aria-valuenow="0"')
  })

  test('distinguishes unlimited quota from a missing percentage', async () => {
    await testI18n.changeLanguage('en')
    const window = createWindow({ remainingRatio: null, isUnlimited: true })
    const entry = createQuotaEntry({ primaryWindows: [window], windows: [window] })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain('aria-valuetext="Unlimited"')
    expect(markup).toContain('∞')
    expect(markup).not.toContain('aria-valuenow="0"')
  })

  test('labels the time of the displayed quota without replacing it with a failed attempt time', async () => {
    await testI18n.changeLanguage('en')
    const observedAt = '2026-11-01T08:00:00Z'
    const lastAttemptAt = '2026-11-05T10:00:00Z'
    const entry = createQuotaEntry({
      observedAt,
      lastAttemptAt,
      collectionStatus: 'failed',
    })
    const markup = renderWithI18n(<UpstreamQuotaCell state={{ kind: 'entry', entry }} />)
    expect(markup).toContain(`dateTime="${observedAt}"`)
    expect(markup).toContain('Collected ')
    expect(markup).toContain('Collected at:')
    expect(markup).not.toContain(lastAttemptAt)
  })
})

describe('UpstreamQuotaDetail rendering', () => {
  test('groups all stable Antigravity windows and ignores legacy scopes', async () => {
    await testI18n.changeLanguage('en')
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

    const markup = renderWithI18n(<UpstreamQuotaDetail item={item} />)
    expect(markup).toContain('Gemini')
    expect(markup).toContain('Claude + GPT')
    expect(markup).toContain('70%')
    expect(markup).toContain('80%')
    expect(markup).toContain('40%')
    expect(markup).toContain('60%')
    expect(markup).not.toContain('13%')
  })

  test('preserves Codex plan and reset-credit detail', async () => {
    await testI18n.changeLanguage('en')
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

    const markup = renderWithI18n(<UpstreamQuotaDetail item={item} />)
    expect(markup).toContain('Pro 20x')
    expect(markup).toContain('Rate-limit reset credits')
    expect(markup).toContain('2 available')
    expect(markup).toContain('Reset credit 1')
    expect(markup).toContain('1 more reset credits')
  })

  test('shows Claude reset counts separately from plan multipliers', async () => {
    await testI18n.changeLanguage('en')
    const item = createQuotaEntry({
      provider: 'claude',
      plan: { name: 'Max 20x', premium: true },
      resetCredits: {
        availableCount: 3,
        observedAt: '2026-10-20T00:00:00Z',
        credits: [],
      },
    })
    const markup = renderWithI18n(<UpstreamQuotaDetail item={item} />)
    expect(markup).toContain('Max 20x')
    expect(markup).toContain('Remaining limit resets')
    expect(markup).toContain('3 remaining')
    expect(markup).not.toContain('expiry details')
    expect(markup).not.toContain('Reset credit 1')

    const unknown = renderWithI18n(<UpstreamQuotaDetail item={{ ...item, resetCredits: null }} />)
    expect(unknown).toContain('Remaining limit resets are not available')
    expect(unknown).not.toContain('0 remaining')
    const zero = renderWithI18n(
      <UpstreamQuotaDetail
        item={{ ...item, resetCredits: { ...item.resetCredits!, availableCount: 0 } }}
      />,
    )
    expect(zero).toContain('0 remaining')
  })
})

describe('GrokQuotaDetail rendering', () => {
  test('marks on-demand as disabled when weekly or monthly windows exist without one', async () => {
    await testI18n.changeLanguage('en')
    const weekly = createXaiWeeklyWindow()
    const entry = createQuotaEntry({
      provider: 'xai',
      plan: { name: 'SuperGrok', premium: false },
      primaryWindows: [weekly],
      windows: [weekly],
      windowCount: 1,
    })

    const markup = renderWithI18n(
      <GrokQuotaDetail entry={entry} headerAction={<button type="button">Refresh quota</button>} />,
    )
    expect(markup).toContain('grok.svg')
    expect(markup).toContain('SuperGrok')
    expect(markup).toContain('Refresh quota')
    expect(markup).toContain('Response header')
    expect(markup).toContain('On-demand')
    expect(markup).toContain('Disabled')
    expect(markup).not.toContain('Not provided')
    expect(markup).toContain('84%')
  })

  test('keeps on-demand as not provided when no known window exists', async () => {
    await testI18n.changeLanguage('en')
    const entry = createQuotaEntry({
      provider: 'xai',
      primaryWindows: [],
      windows: [],
      windowCount: 0,
    })

    const markup = renderWithI18n(<GrokQuotaDetail entry={entry} />)
    expect(markup).toContain('On-demand')
    expect(markup).toContain('Not provided')
    expect(markup).not.toContain('Disabled')
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

describe('credential quota action states', () => {
  const resource = { provider: 'meta', disabled: false, status: 'active' }
  const decide = (entry: UpstreamQuotaEntry | null, overrides = {}) =>
    resolveCredentialQuotaAction({ resource, entry, available: true, ...overrides })
  test('offers collection for an existing never-collected backend entry', () => {
    expect(
      decide(
        createQuotaEntry({
          provider: 'meta',
          status: 'unknown',
          freshness: 'never',
          collectionStatus: 'idle',
          lastAttemptAt: null,
          primaryWindows: [],
          windows: [],
          windowCount: 0,
        }),
      ),
    ).toBe('collect')
    expect(decide(null)).toBe('collect')
  })
  test('offers refresh or retry and blocks local and remote duplicate collection', () => {
    expect(decide(createQuotaEntry())).toBe('refresh')
    expect(decide(createQuotaEntry({ collectionStatus: 'failed' }))).toBe('retry')
    expect(decide(createQuotaEntry({ collectionStatus: 'partial' }))).toBe('retry')
    expect(decide(createQuotaEntry({ collectionStatus: 'collecting' }))).toBe('collecting')
    expect(decide(null, { collecting: true })).toBe('collecting')
  })
  test('honors capabilities, disabled and unsupported credentials without blocking execution cooldown', () => {
    expect(decide(null, { available: false })).toBe('unavailable')
    expect(decide(null, { resource: { ...resource, disabled: true } })).toBe('disabled')
    expect(decide(createQuotaEntry({ credentialStatus: 'disabled' }))).toBe('disabled')
    expect(decide(createQuotaEntry({ credentialType: 'provider_api_key' }))).toBe('unsupported')
    expect(decide(createQuotaEntry({ collectionStatus: 'unsupported' }))).toBe('unsupported')
    expect(
      decide(createQuotaEntry({ credentialStatus: 'cooldown' }), {
        resource: { ...resource, status: 'error' },
      }),
    ).toBe('refresh')
  })
  test('keeps an existing quota visible during background refresh', () => {
    const entry = createQuotaEntry()
    expect(
      resolveUpstreamQuotaCellState({
        available: true,
        loading: true,
        truncated: false,
        map: buildUpstreamQuotaJoinMap([entry]),
        resource: { id: entry.id, authIndex: entry.authIndex, name: null, identifier: entry.id },
      }),
    ).toEqual({ kind: 'entry', entry })
  })
})
