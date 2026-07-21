import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { UpstreamQuotaCell } from '@/features/upstream/quota-cells'
import { withUpstreamQuotaMock } from '@/features/upstream/quota-mock'
import {
  type UpstreamQuotaEntry,
  buildUpstreamQuotaJoinMap,
  findCurrencyWindow,
  findUpstreamQuotaEntry,
  isQuotaAttentionStatus,
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
    windows: [],
    windowCount: 1,
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

describe('isQuotaAttentionStatus', () => {
  test('matches low/exhausted/error only', () => {
    expect(isQuotaAttentionStatus('low')).toBe(true)
    expect(isQuotaAttentionStatus('exhausted')).toBe(true)
    expect(isQuotaAttentionStatus('error')).toBe(true)
    expect(isQuotaAttentionStatus('healthy')).toBe(false)
    expect(isQuotaAttentionStatus('unknown')).toBe(false)
    expect(isQuotaAttentionStatus('unsupported')).toBe(false)
  })
})

describe('findCurrencyWindow', () => {
  test('finds the currency window outside on-demand entries', () => {
    const entry = createXaiEntry()
    const currencyWindow = findCurrencyWindow(entry)
    expect(currencyWindow?.id).toBe('xai-monthly-spend')
  })
})

describe('withUpstreamQuotaMock', () => {
  test('enriches xai entries only when enabled', () => {
    const xai = createXaiEntry()
    const claude = createQuotaEntry()

    const enriched = withUpstreamQuotaMock([xai, claude], true)
    expect(enriched[0].grokPlan?.name).toBe('SuperGrok')
    expect(enriched[0].grokOnDemand?.unit).toBe('currency')
    expect(enriched[1].grokPlan ?? null).toBeNull()

    const untouched = withUpstreamQuotaMock([xai], false)
    expect(untouched[0].grokPlan ?? null).toBeNull()
    expect(untouched[0].grokOnDemand ?? null).toBeNull()
  })
})

describe('UpstreamQuotaCell rendering', () => {
  test('renders grok plan and on-demand rows when fields exist', () => {
    const entry = withUpstreamQuotaMock([createXaiEntry()], true)[0]
    const markup = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'entry', entry }} />,
    )
    expect(markup).toContain('SuperGrok')
    expect(markup).toContain('$42.00')
    expect(markup).toContain('$150.00')
  })

  test('degrades to the currency window without grok fields', () => {
    const entry = createXaiEntry()
    const markup = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'entry', entry }} />,
    )
    expect(markup).not.toContain('SuperGrok')
    expect(markup).toContain('$42.00')
  })

  test('renders generic windows for other providers', () => {
    const markup = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'entry', entry: createQuotaEntry() }} />,
    )
    expect(markup).toContain('82%')
  })

  test('renders not-collected and capability-absent states', async () => {
    const i18n = (await import('i18next')).default
    await i18n.changeLanguage('en')

    const notCollected = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'not-collected' }} />,
    )
    expect(notCollected).toContain('Not collected')

    const absent = renderToStaticMarkup(
      <UpstreamQuotaCell state={{ kind: 'capability-absent' }} />,
    )
    expect(absent).toContain('Unsupported')

    const loading = renderToStaticMarkup(<UpstreamQuotaCell state={{ kind: 'loading' }} />)
    expect(loading).toContain('data-slot="skeleton"')
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
