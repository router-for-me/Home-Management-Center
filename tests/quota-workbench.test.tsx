import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import i18n from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'

import { navigationGroups } from '@/components/shell/navigation'
import {
  findCredentialRouteResource,
  normalizeCredentialRouteSearch,
} from '@/features/credentials/credential-route'
import { QuotaTable, getQuotaWindowDisplayLabel } from '@/features/quota/quota-components'
import {
  defaultQuotaFilters,
  filterAndSortQuotaCredentials,
  getQuotaVerdict,
  normalizeQuotaRouteSearch,
  supportsAccountCredentialRoute,
} from '@/features/quota/quota-model'
import { QuotaWorkbenchPage } from '@/features/quota/quota-workbench-page'
import { toManagementApiError } from '@/lib/api/management/client'
import type { CredentialResource } from '@/lib/api/management/credentials'
import { normalizeQuotaCredentialDetail, normalizeQuotaSnapshot } from '@/lib/api/management/quota'
import '@/lib/i18n/i18n'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'
import { useSessionStore } from '@/stores/session-store'

const initialSessionState = useSessionStore.getState()

function getLeafPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    getLeafPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

function createQuotaListContractResponse() {
  return normalizeQuotaSnapshot({
    generated_at: '2026-07-15T05:00:00Z',
    sort: 'risk_desc',
    items: [
      {
        credential_id: 'credential-xai',
        auth_index: 'auth-xai',
        label: 'xai-account.json',
        provider: 'xai',
        credential_type: 'oauth',
        credential_status: 'cooldown',
        quota_status: 'exhausted',
        freshness: 'fresh',
        source: 'active_probe',
        collection_status: 'success',
        observed_at: '2026-07-15T04:53:00Z',
        earliest_reset_at: '2026-07-15T07:00:00Z',
        window_count: 2,
        primary_windows: [
          {
            id: 'xai-weekly',
            scope: 'model',
            scope_id: 'Grok',
            mode: 'rolling',
            status: 'exhausted',
            unit: 'percentage',
            remaining: 0,
            limit: 100,
            remaining_ratio: 0,
            reset_at: '2026-07-15T07:00:00Z',
            period_unit: 'week',
            period_value: 1,
            source: 'active_probe',
          },
          {
            id: 'xai-monthly',
            scope: 'model',
            scope_id: 'Grok',
            mode: 'balance',
            status: 'exhausted',
            unit: 'currency',
            currency: 'USD',
            remaining: 0,
            limit: 100,
            remaining_ratio: 0,
            reset_at: '2026-08-01T00:00:00Z',
            period_unit: 'month',
            period_value: 1,
            source: 'active_probe',
          },
        ],
      },
      {
        credential_id: 'credential-codex',
        auth_index: 'auth-codex',
        label: 'codex-primary.json',
        provider: 'codex',
        credential_type: 'oauth',
        credential_status: 'enabled',
        quota_status: 'low',
        freshness: 'fresh',
        source: 'mixed',
        collection_status: 'success',
        observed_at: '2026-07-15T04:56:00Z',
        earliest_reset_at: '2026-07-15T05:45:00Z',
        window_count: 3,
        primary_windows: [
          {
            id: 'codex-five-hour',
            scope: 'model',
            scope_id: 'General',
            mode: 'rolling',
            status: 'low',
            unit: 'percentage',
            remaining: 18,
            limit: 100,
            remaining_ratio: 0.18,
            reset_at: '2026-07-15T06:34:00Z',
            period_unit: 'hour',
            period_value: 5,
            source: 'response_header',
          },
          {
            id: 'codex-weekly',
            scope: 'model',
            scope_id: 'General',
            mode: 'rolling',
            status: 'healthy',
            unit: 'percentage',
            remaining: 63,
            limit: 100,
            remaining_ratio: 0.63,
            reset_at: '2026-07-19T11:00:00Z',
            period_unit: 'week',
            period_value: 1,
            source: 'active_probe',
          },
        ],
      },
      {
        credential_id: 'credential-antigravity',
        auth_index: 'auth-antigravity',
        label: 'antigravity.json',
        provider: 'antigravity',
        project: 'project-lab',
        credential_type: 'oauth',
        credential_status: 'enabled',
        quota_status: 'low',
        freshness: 'fresh',
        source: 'active_probe',
        collection_status: 'partial',
        observed_at: '2026-07-15T04:48:00Z',
        earliest_reset_at: '2026-07-15T08:00:00Z',
        window_count: 1,
        primary_windows: [
          {
            id: 'antigravity-daily',
            scope: 'project',
            scope_id: 'project-lab',
            mode: 'fixed',
            status: 'low',
            unit: 'percentage',
            remaining: 22,
            limit: 100,
            remaining_ratio: 0.22,
            reset_at: '2026-07-15T08:00:00Z',
            period_unit: 'day',
            period_value: 1,
            source: 'active_probe',
          },
        ],
      },
      {
        credential_id: 'credential-claude-failed',
        auth_index: 'auth-claude-failed',
        label: 'claude-failed.json',
        provider: 'claude',
        credential_type: 'file_auth',
        credential_status: 'unavailable',
        quota_status: 'error',
        freshness: 'stale',
        source: 'active_probe',
        collection_status: 'failed',
        observed_at: '2026-07-14T23:00:00Z',
        earliest_reset_at: null,
        window_count: 0,
        primary_windows: [],
      },
      {
        credential_id: 'credential-codex-disabled',
        auth_index: 'auth-codex-disabled',
        label: 'codex-disabled.json',
        provider: 'codex',
        credential_type: 'oauth',
        credential_status: 'disabled',
        quota_status: 'unknown',
        freshness: 'never',
        source: null,
        collection_status: 'idle',
        earliest_reset_at: null,
        window_count: 0,
        primary_windows: [],
      },
    ],
  })
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  useSessionStore.setState(initialSessionState, true)
})

describe('quota workbench', () => {
  test('places quota lookup after account credentials in the Gateway navigation', () => {
    const gatewayGroup = navigationGroups.find((group) => group.id === 'gateway')

    expect(gatewayGroup?.items.map((item) => item.to)).toEqual([
      '/admin/providers',
      '/admin/credentials',
      '/admin/quota',
      '/admin/access-keys',
      '/admin/users',
    ])
  })

  test('keeps quota navigation and state copy in every supported locale', () => {
    const expectedQuotaKeys = getLeafPaths(en.common.quotaPage).sort()

    for (const locale of [zhCN, zhTW, en, ru]) {
      expect(locale.common.navigation.quota).toBeTruthy()
      expect(locale.common.navigationMeta.quota).toBeTruthy()
      expect(locale.common.quotaPage.header.title).toBeTruthy()
      expect(locale.common.quotaPage.snapshot.unsupportedDescription).toContain('/api-call')
      expect(locale.common.quotaPage.filters.searchPlaceholder).not.toContain('auth_index')
      expect(getLeafPaths(locale.common.quotaPage).sort()).toEqual(expectedQuotaKeys)
    }
  })

  test('keeps the global verdict aligned with backend needs_attention semantics', () => {
    const healthySummary = {
      total: 1,
      healthy: 1,
      low: 0,
      exhausted: 0,
      unknown: 0,
      error: 0,
      unsupported: 0,
      stale: 0,
      never: 0,
      collecting: 0,
      needsAttention: 0,
    }

    expect(getQuotaVerdict(healthySummary)).toBe('healthy')
    expect(getQuotaVerdict({ ...healthySummary, needsAttention: 1 })).toBe('partial')
    expect(getQuotaVerdict({ ...healthySummary, healthy: 0, low: 1, needsAttention: 1 })).toBe(
      'attention',
    )
    expect(
      getQuotaVerdict({
        ...healthySummary,
        healthy: 0,
        low: 1,
        error: 1,
        needsAttention: 2,
      }),
    ).toBe('partial')
  })

  test('only links quota items that exist in the account credential workspace', () => {
    expect(supportsAccountCredentialRoute('oauth')).toBe(true)
    expect(supportsAccountCredentialRoute('file_auth')).toBe(true)
    expect(supportsAccountCredentialRoute('vertex')).toBe(true)
    expect(supportsAccountCredentialRoute('provider_api_key')).toBe(false)
    expect(supportsAccountCredentialRoute('unknown')).toBe(false)
  })

  test('offers connection management when the runtime is disconnected', () => {
    useSessionStore.getState().disconnect()

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <QuotaWorkbenchPage />
      </QueryClientProvider>,
    )

    expect(markup).toContain('Connect a management runtime')
    expect(markup).toContain('Connect runtime')
  })

  test('keeps the list contract compressed without losing aggregate window facts', () => {
    const snapshot = createQuotaListContractResponse()

    expect(snapshot.items).toHaveLength(5)
    expect(snapshot.items.every((item) => item.windows.length === 0)).toBe(true)
    expect(snapshot.items.every((item) => item.primaryWindows.length <= 2)).toBe(true)
    const codex = snapshot.items.find((item) => item.id === 'credential-codex')!
    expect(codex.windowCount).toBe(3)
    expect(codex.primaryWindows).toHaveLength(2)
    expect(codex.earliestResetAt).toBe('2026-07-15T05:45:00Z')
    expect(codex.primaryWindows.some((window) => window.resetAt === codex.earliestResetAt)).toBe(
      false,
    )
  })

  test('keeps the quota table view action visibly labeled', () => {
    const snapshot = createQuotaListContractResponse()
    const markup = renderToStaticMarkup(
      <QuotaTable items={[snapshot.items[0]!]} hasAnyItems onView={() => undefined} />,
    )

    expect(markup).toContain('View details')
  })

  test('marks stale reset timestamps as last-known values', () => {
    const snapshot = createQuotaListContractResponse()
    const item = snapshot.items.find((candidate) => candidate.id === 'credential-xai')!
    const markup = renderToStaticMarkup(
      <QuotaTable items={[{ ...item, freshness: 'stale' }]} hasAnyItems onView={() => undefined} />,
    )

    expect(markup).toContain('Last known value')
  })

  test('localizes structured quota periods without exposing mixed raw labels', async () => {
    const snapshot = createQuotaListContractResponse()
    const xai = snapshot.items.find((item) => item.id === 'credential-xai')!

    await i18n.changeLanguage('zh-CN')
    const markup = renderToStaticMarkup(<QuotaTable items={[xai]} hasAnyItems onView={() => {}} />)

    expect(markup).toContain('每周')
    expect(markup).toContain('每月')
    expect(markup).toContain('模型：Grok')
    expect(markup).not.toContain('Weekly')
    expect(markup).not.toContain('Monthly credit')
    expect(getQuotaWindowDisplayLabel(xai.primaryWindows[0]!, i18n.t, 'zh-CN')).toBe('每周')
  })

  test('does not invent USD when a currency window omits its currency', () => {
    const snapshot = createQuotaListContractResponse()
    const item = snapshot.items[0]!
    const currencyWindow = {
      ...item.primaryWindows[0]!,
      unit: 'currency' as const,
      currency: null,
      remaining: 25,
      limit: 100,
    }
    const markup = renderToStaticMarkup(
      <QuotaTable
        items={[{ ...item, primaryWindows: [currencyWindow], windowCount: 1 }]}
        hasAnyItems
        onView={() => undefined}
      />,
    )

    expect(markup).toContain('currency unknown')
    expect(markup).not.toContain('$25')
  })

  test('filters credentials and keeps the highest quota risk first', () => {
    const snapshot = createQuotaListContractResponse()
    const sorted = filterAndSortQuotaCredentials(snapshot.items, defaultQuotaFilters)
    const codexOnly = filterAndSortQuotaCredentials(snapshot.items, {
      ...defaultQuotaFilters,
      provider: 'codex',
    })
    const searchResult = filterAndSortQuotaCredentials(snapshot.items, {
      ...defaultQuotaFilters,
      search: 'project-lab',
    })
    const failedCollections = filterAndSortQuotaCredentials(snapshot.items, {
      ...defaultQuotaFilters,
      collectionStatus: 'failed',
    })
    const disabledCredentials = filterAndSortQuotaCredentials(snapshot.items, {
      ...defaultQuotaFilters,
      credentialStatus: 'disabled',
    })
    const resetOrder = filterAndSortQuotaCredentials(snapshot.items, {
      ...defaultQuotaFilters,
      sort: 'reset_at_asc',
    })

    expect(sorted[0]?.status).toBe('exhausted')
    expect(sorted[1]?.status).toBe('low')
    expect(sorted[2]?.status).toBe('low')
    expect(sorted[3]?.status).toBe('error')
    expect(codexOnly.every((item) => item.provider === 'codex')).toBe(true)
    expect(searchResult.map((item) => item.id)).toEqual(['credential-antigravity'])
    expect(failedCollections.map((item) => item.id)).toEqual(['credential-claude-failed'])
    expect(disabledCredentials.map((item) => item.id)).toEqual(['credential-codex-disabled'])
    expect(resetOrder[0]?.id).toBe('credential-codex')
    expect(resetOrder.at(-1)?.earliestResetAt).toBeNull()
  })

  test('normalizes the quota deep-link search used by both router trees', () => {
    expect(normalizeQuotaRouteSearch({ q: ' auth-xai-heavy ' })).toEqual({
      q: 'auth-xai-heavy',
    })
    expect(normalizeQuotaRouteSearch({ q: 42 })).toEqual({ q: undefined })
  })

  test('normalizes and resolves credential deep links with an auth-index fallback', () => {
    expect(
      normalizeCredentialRouteSearch({ credential: ' credential-1 ', q: ' auth-xai-heavy ' }),
    ).toEqual({ credential: 'credential-1', q: 'auth-xai-heavy' })

    const resources = [
      {
        id: 'xai:backend-resource-1',
        identifier: 'backend-resource-1',
        authIndex: 'auth-xai-heavy',
        name: 'xai-heavy.json',
      },
    ] as CredentialResource[]

    expect(findCredentialRouteResource(resources, 'credential-1', 'auth-xai-heavy')?.id).toBe(
      'xai:backend-resource-1',
    )
  })

  test('normalizes the current backend snake-case contract', () => {
    const snapshot = normalizeQuotaSnapshot({
      generated_at: '2026-07-15T05:00:00Z',
      total: 42,
      limit: 20,
      offset: 20,
      sort: 'risk_desc',
      summary: {
        total_credentials: 42,
        low: 7,
        healthy: 35,
        needs_attention: 7,
        last_observed_at: '2026-07-15T04:59:00Z',
      },
      global_summary: {
        total_credentials: 99,
        low: 8,
        healthy: 91,
        needs_attention: 8,
      },
      facets: {
        providers: [
          { value: 'claude', count: 30 },
          { value: 'xai', count: 12 },
        ],
      },
      items: [
        {
          credential_id: 'credential-1',
          auth_index: 'auth-1',
          label: 'Claude Team',
          provider: 'claude',
          credential_type: 'oauth',
          project: 'project-alpha',
          credential_status: 'enabled',
          quota_status: 'low',
          freshness: 'fresh',
          source: 'mixed',
          collection_status: 'partial',
          observed_at: '2026-07-15T04:59:00Z',
          earliest_reset_at: '2026-07-15T06:00:00Z',
          last_attempt_at: '2026-07-15T04:58:00Z',
          consecutive_failures: 2,
          window_count: 3,
          runtime: {
            home_id: 'home-01:8327',
            home_label: 'Home primary',
            cpa_node_id: 'cpa-01',
            cpa_node_label: 'CPA 01',
          },
          primary_windows: [
            {
              id: 'five-hour',
              label: null,
              scope: 'model',
              scope_id: 'Claude',
              mode: 'rolling',
              status: 'low',
              unit: 'percentage',
              remaining: 18,
              limit: 100,
              used_ratio: 0.82,
              remaining_ratio: 0.18,
              is_unlimited: false,
              window_seconds: 18000,
              period_unit: 'hour',
              period_value: 5,
              source: 'response_header',
            },
            {
              id: 'monthly-credit',
              label: null,
              scope: 'account',
              mode: 'balance',
              status: 'healthy',
              unit: 'currency',
              currency: 'USD',
              remaining: 25,
              limit: 100,
              remaining_ratio: 0.25,
              is_unlimited: false,
              period_unit: 'month',
              period_value: 1,
              source: 'active_probe',
            },
          ],
          error: {
            code: 'partial_data',
            message: 'Profile request failed.',
            retryable: true,
            occurred_at: '2026-07-15T04:58:30Z',
            upstream_status_code: 503,
            request_id: 'req-quota-1',
          },
        },
      ],
    })

    expect(snapshot.items[0]).toMatchObject({
      id: 'credential-1',
      authIndex: 'auth-1',
      name: 'Claude Team',
      status: 'low',
      collectionStatus: 'partial',
      source: 'mixed',
      credentialType: 'oauth',
      project: 'project-alpha',
      earliestResetAt: '2026-07-15T06:00:00Z',
      lastAttemptAt: '2026-07-15T04:58:00Z',
      consecutiveFailures: 2,
      windowCount: 3,
    })
    expect(snapshot.items[0]?.primaryWindows[0]).toMatchObject({
      id: 'five-hour',
      scope: 'model',
      scopeId: 'Claude',
      mode: 'rolling',
      unit: 'percentage',
      usedRatio: 0.82,
      remainingRatio: 0.18,
      periodUnit: 'hour',
      periodValue: 5,
      source: 'response_header',
    })
    expect(snapshot.items[0]?.primaryWindows[1]).toMatchObject({
      unit: 'currency',
      currency: 'USD',
      periodUnit: 'month',
      periodValue: 1,
    })
    expect(snapshot.items[0]?.lastError).toEqual({
      code: 'partial_data',
      message: 'Profile request failed.',
      retryable: true,
      occurredAt: '2026-07-15T04:58:30Z',
      upstreamStatusCode: 503,
      requestId: 'req-quota-1',
    })
    expect(snapshot.items[0]?.runtime).toEqual({
      homeId: 'home-01:8327',
      homeLabel: 'Home primary',
      cpaNodeId: 'cpa-01',
      cpaNodeLabel: 'CPA 01',
    })
    expect(snapshot.items[0]?.windows).toEqual([])
    expect(snapshot).toMatchObject({
      total: 42,
      limit: 20,
      offset: 20,
      summary: { total: 42, low: 7, needsAttention: 7 },
      globalSummary: { total: 99, low: 8, needsAttention: 8 },
      facets: {
        providers: [
          { value: 'claude', count: 30 },
          { value: 'xai', count: 12 },
        ],
      },
    })
  })

  test('does not infer quota periods from legacy labels or window seconds', () => {
    const detail = normalizeQuotaCredentialDetail({
      credential: {
        credential_id: 'credential-period-contract',
        provider: 'xai',
        quota_status: 'healthy',
        freshness: 'fresh',
        collection_status: 'success',
        source: 'active_probe',
      },
      windows: [
        {
          id: 'legacy-weekly',
          label: 'Weekly',
          window_seconds: 604800,
          status: 'healthy',
          unit: 'percentage',
          source: 'active_probe',
        },
        {
          id: 'invalid-structured-period',
          period_unit: 'week',
          period_value: 0,
          status: 'healthy',
          unit: 'percentage',
          source: 'active_probe',
        },
        {
          id: 'structured-minutes',
          label: 'Provider rolling window',
          period_unit: 'minute',
          period_value: 15,
          status: 'healthy',
          unit: 'requests',
          source: 'active_probe',
        },
      ],
    })

    expect(detail.windows[0]).toMatchObject({
      label: 'Weekly',
      periodUnit: 'unknown',
      periodValue: null,
    })
    expect(getQuotaWindowDisplayLabel(detail.windows[0]!, i18n.t, 'en')).toBe('Weekly')
    expect(detail.windows[1]).toMatchObject({
      label: null,
      periodUnit: 'unknown',
      periodValue: null,
    })
    expect(getQuotaWindowDisplayLabel(detail.windows[1]!, i18n.t, 'en')).toBe('Unknown period')
    expect(detail.windows[2]).toMatchObject({
      periodUnit: 'minute',
      periodValue: 15,
    })
    expect(getQuotaWindowDisplayLabel(detail.windows[2]!, i18n.t, 'en')).toBe('15 minutes')
  })

  test('rejects ratios outside the backend contract instead of converting percentages', () => {
    const detail = normalizeQuotaCredentialDetail({
      credential: {
        credential_id: 'credential-ratio-contract',
        provider: 'codex',
        quota_status: 'healthy',
        freshness: 'fresh',
        collection_status: 'success',
        source: 'active_probe',
      },
      windows: [
        {
          id: 'invalid-ratio',
          status: 'healthy',
          unit: 'percentage',
          used_ratio: -0.1,
          remaining_ratio: 18,
          source: 'active_probe',
        },
      ],
    })

    expect(detail.windows[0]).toMatchObject({
      usedRatio: null,
      remainingRatio: null,
    })
  })

  test('keeps list preview windows separate from complete detail windows', () => {
    const previewWindows = [
      {
        id: 'primary',
        scope: 'account',
        mode: 'rolling',
        status: 'healthy',
        unit: 'percentage',
        source: 'active_probe',
      },
      {
        id: 'secondary',
        scope: 'account',
        mode: 'rolling',
        status: 'healthy',
        unit: 'percentage',
        source: 'active_probe',
      },
    ]
    const detail = normalizeQuotaCredentialDetail({
      credential: {
        credential_id: 'credential-window-contract',
        provider: 'codex',
        quota_status: 'healthy',
        freshness: 'fresh',
        collection_status: 'success',
        source: 'active_probe',
        earliest_reset_at: '2026-07-15T05:30:00Z',
        primary_windows: previewWindows,
        window_count: 3,
      },
      windows: [
        ...previewWindows,
        {
          id: 'hidden-earliest',
          scope: 'model',
          mode: 'rolling',
          status: 'healthy',
          unit: 'percentage',
          reset_at: '2026-07-15T05:30:00Z',
          source: 'active_probe',
        },
      ],
    })

    expect(detail.primaryWindows.map((window) => window.id)).toEqual(['primary', 'secondary'])
    expect(detail.windows.map((window) => window.id)).toEqual([
      'primary',
      'secondary',
      'hidden-earliest',
    ])
    expect(detail.windowCount).toBe(3)
    expect(detail.earliestResetAt).toBe('2026-07-15T05:30:00Z')
  })

  test('keeps nested detail collection success timestamps', () => {
    const detail = normalizeQuotaCredentialDetail({
      credential: {
        credential_id: 'credential-1',
        label: 'Claude Team',
        provider: 'claude',
        quota_status: 'healthy',
        freshness: 'fresh',
        collection_status: 'success',
        source: 'response_header',
      },
      windows: [],
      collection: {
        status: 'success',
        source: 'response_header',
        freshness: 'fresh',
        last_success_at: '2026-07-15T04:59:00Z',
      },
    })

    expect(detail.lastSuccessAt).toBe('2026-07-15T04:59:00Z')
  })

  test('preserves structured Management API error details', () => {
    const error = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: {
        status: 503,
        data: {
          error: {
            code: 'QUOTA_SNAPSHOTS_LOAD_FAILED',
            message: 'failed to load quota snapshots',
            request_id: 'req-quota-load',
            retryable: true,
          },
        },
      },
    })

    expect(toManagementApiError(error)).toEqual({
      message: 'failed to load quota snapshots',
      status: 503,
      code: 'server',
      backendCode: 'QUOTA_SNAPSHOTS_LOAD_FAILED',
      requestId: 'req-quota-load',
      retryable: true,
    })
  })
})
