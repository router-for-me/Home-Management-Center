import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import { navigationGroups } from '@/components/shell/navigation'
import {
  findCredentialRouteResource,
  normalizeCredentialRouteSearch,
} from '@/features/credentials/credential-route'
import { getUpstreamQuotaWindowDisplayLabel } from '@/features/upstream/quota-format'
import { toManagementApiError } from '@/lib/api/management/client'
import type { CredentialResource } from '@/lib/api/management/credentials'
import { normalizeQuotaCredentialDetail, normalizeQuotaSnapshot } from '@/lib/api/management/quota'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

const testI18n = createInstance()

function getLeafPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    getLeafPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

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

beforeEach(async () => {
  await testI18n.changeLanguage('en')
})

describe('upstream navigation and i18n', () => {
  test('leads the Gateway navigation with the merged upstream workbench', () => {
    const gatewayGroup = navigationGroups.find((group) => group.id === 'gateway')

    expect(gatewayGroup?.items.map((item) => item.to)).toEqual([
      '/admin/upstream',
      '/admin/access-keys',
      '/admin/users',
    ])
  })

  test('keeps upstream page copy in every supported locale', () => {
    const expectedKeys = getLeafPaths(en.common.upstreamPage).sort()

    for (const locale of [zhCN, zhTW, en, ru]) {
      expect(locale.common.navigation.upstream).toBeTruthy()
      expect(locale.common.navigationMeta.upstream).toBeTruthy()
      expect(locale.common.upstreamPage.header.title).toBeTruthy()
      expect(locale.common.upstreamPage.drawer.tabs.quota).toBeTruthy()
      expect(locale.common.upstreamPage.quota.status.healthy).toBeTruthy()
      expect(locale.common.upstreamPage.quota.window.period.week).toBeTruthy()
      expect(getLeafPaths(locale.common.upstreamPage).sort()).toEqual(expectedKeys)
    }
  })
})

describe('quota snapshot normalization contracts', () => {
  test('surfaces the xAI plan metadata from the backend contract', () => {
    const snapshot = normalizeQuotaSnapshot({
      generated_at: '2026-07-21T05:00:00Z',
      items: [
        {
          credential_id: 'credential-xai',
          auth_index: 'auth-xai',
          provider: 'xai',
          credential_type: 'oauth',
          quota_status: 'healthy',
          freshness: 'fresh',
          source: 'active_probe',
          collection_status: 'success',
          plan: { name: 'SuperGrok Heavy', premium: true },
          window_count: 2,
          primary_windows: [
            {
              id: 'xai-monthly-spend',
              scope: 'account',
              mode: 'fixed',
              status: 'healthy',
              unit: 'currency',
              currency: 'USD',
              remaining: 108,
              limit: 150,
              source: 'active_probe',
            },
            {
              id: 'xai-on-demand',
              scope: 'account',
              mode: 'balance',
              status: 'healthy',
              unit: 'currency',
              currency: 'USD',
              remaining: 38,
              limit: 50,
              source: 'active_probe',
            },
          ],
        },
      ],
    })

    const item = snapshot.items[0]
    expect(item?.plan).toEqual({ name: 'SuperGrok Heavy', premium: true })
    expect(item?.primaryWindows[1]?.id).toBe('xai-on-demand')
  })

  test('omits plan when the backend does not report one', () => {
    const snapshot = normalizeQuotaSnapshot({
      items: [
        {
          credential_id: 'credential-codex',
          provider: 'codex',
          quota_status: 'healthy',
          freshness: 'fresh',
          collection_status: 'success',
        },
      ],
    })

    expect(snapshot.items[0]?.plan).toBeNull()
    expect(snapshot.items[0]?.resetCredits).toBeNull()
  })

  test('normalizes Codex plan and detail-only reset credits', () => {
    const detail = normalizeQuotaCredentialDetail({
      credential: {
        credential_id: 'credential-codex-pro',
        provider: 'codex',
        quota_status: 'healthy',
        freshness: 'fresh',
        collection_status: 'success',
        source: 'active_probe',
        plan: { name: 'Pro 20x', premium: true },
      },
      windows: [],
      reset_credits: {
        available_count: 3,
        observed_at: '2026-07-22T01:00:00Z',
        credits: [
          {
            status: 'available',
            granted_at: '2026-07-20T00:00:00Z',
            expires_at: '2026-07-27T07:40:51Z',
          },
        ],
      },
    })

    expect(detail.plan).toEqual({ name: 'Pro 20x', premium: true })
    expect(detail.resetCredits).toEqual({
      availableCount: 3,
      observedAt: '2026-07-22T01:00:00Z',
      credits: [
        {
          status: 'available',
          grantedAt: '2026-07-20T00:00:00Z',
          expiresAt: '2026-07-27T07:40:51Z',
        },
      ],
    })
  })

  test('preserves backend-selected Codex families across a three-window detail response', () => {
    const accountFiveHour = {
      id: 'codex-5-hour',
      scope: 'account',
      mode: 'rolling',
      status: 'healthy',
      unit: 'percentage',
      remaining_ratio: 0.82,
      period_unit: 'hour',
      period_value: 5,
      source: 'active_probe',
    }
    const accountWeekly = {
      id: 'codex-1-week',
      scope: 'account',
      mode: 'rolling',
      status: 'healthy',
      unit: 'percentage',
      remaining_ratio: 0.91,
      period_unit: 'week',
      period_value: 1,
      source: 'active_probe',
    }
    const sparkWeekly = {
      id: 'codex-bengalfox-1-week',
      label: 'GPT-5.3-Codex-Spark',
      scope: 'model',
      scope_id: 'codex_bengalfox',
      mode: 'rolling',
      status: 'healthy',
      unit: 'percentage',
      remaining_ratio: 1,
      period_unit: 'week',
      period_value: 1,
      source: 'active_probe',
    }
    const detail = normalizeQuotaCredentialDetail({
      credential: {
        credential_id: 'credential-codex-families',
        provider: 'codex',
        quota_status: 'healthy',
        freshness: 'fresh',
        collection_status: 'partial',
        source: 'active_probe',
        plan: { name: 'Pro 20x', premium: true },
        window_count: 3,
        primary_windows: [accountWeekly, sparkWeekly],
      },
      windows: [accountFiveHour, accountWeekly, sparkWeekly],
      reset_credits: {
        available_count: 1,
        observed_at: '2026-07-23T01:00:00Z',
        credits: [],
      },
    })

    expect(detail.primaryWindows.map((window) => window.id)).toEqual([
      'codex-1-week',
      'codex-bengalfox-1-week',
    ])
    expect(detail.windows.map((window) => window.id)).toEqual([
      'codex-5-hour',
      'codex-1-week',
      'codex-bengalfox-1-week',
    ])
    expect(detail.windowCount).toBe(3)
    expect(detail.collectionStatus).toBe('partial')
    expect(detail.resetCredits).toEqual({
      availableCount: 1,
      observedAt: '2026-07-23T01:00:00Z',
      credits: [],
    })
  })

  test('preserves backend-separated passive Codex quota families without inference', () => {
    const snapshot = normalizeQuotaSnapshot({
      items: [
        {
          credential_id: 'credential-codex-passive',
          provider: 'codex',
          quota_status: 'healthy',
          freshness: 'fresh',
          collection_status: 'partial',
          source: 'mixed',
          window_count: 2,
          primary_windows: [
            {
              id: 'codex-1-week',
              scope: 'account',
              mode: 'rolling',
              status: 'healthy',
              unit: 'percentage',
              remaining_ratio: 0.42,
              period_unit: 'week',
              period_value: 1,
              source: 'active_probe',
            },
            {
              id: 'codex-bengalfox-1-week',
              label: 'GPT-5.3-Codex-Spark',
              scope: 'model',
              scope_id: 'codex_bengalfox',
              mode: 'rolling',
              status: 'healthy',
              unit: 'percentage',
              remaining_ratio: 0.98,
              period_unit: 'week',
              period_value: 1,
              source: 'response_header',
            },
          ],
        },
      ],
    })

    expect(
      snapshot.items[0]?.primaryWindows.map((window) => ({
        id: window.id,
        scope: window.scope,
        scopeId: window.scopeId,
        remainingRatio: window.remainingRatio,
        source: window.source,
      })),
    ).toEqual([
      {
        id: 'codex-1-week',
        scope: 'account',
        scopeId: null,
        remainingRatio: 0.42,
        source: 'active_probe',
      },
      {
        id: 'codex-bengalfox-1-week',
        scope: 'model',
        scopeId: 'codex_bengalfox',
        remainingRatio: 0.98,
        source: 'response_header',
      },
    ])
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
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[0]!, testI18n.t, 'en')).toBe('Weekly')
    expect(detail.windows[1]).toMatchObject({
      label: null,
      periodUnit: 'unknown',
      periodValue: null,
    })
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[1]!, testI18n.t, 'en')).toBe(
      'Unknown period',
    )
    expect(detail.windows[2]).toMatchObject({
      periodUnit: 'minute',
      periodValue: 15,
    })
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[2]!, testI18n.t, 'en')).toBe(
      '15 minutes',
    )
  })

  test('localizes structured quota periods', async () => {
    const detail = normalizeQuotaCredentialDetail({
      credential: {
        credential_id: 'credential-locale-contract',
        provider: 'xai',
        quota_status: 'healthy',
        freshness: 'fresh',
        collection_status: 'success',
        source: 'active_probe',
      },
      windows: [
        {
          id: 'weekly',
          period_unit: 'week',
          period_value: 1,
          status: 'healthy',
          unit: 'percentage',
          source: 'active_probe',
        },
        {
          id: 'monthly',
          period_unit: 'month',
          period_value: 1,
          status: 'healthy',
          unit: 'currency',
          currency: 'USD',
          source: 'active_probe',
        },
      ],
    })

    await testI18n.changeLanguage('zh-CN')
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[0]!, testI18n.t, 'zh-CN')).toBe('每周')
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[1]!, testI18n.t, 'zh-CN')).toBe('每月')
    await testI18n.changeLanguage('en')
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
})
