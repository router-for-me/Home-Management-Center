import { beforeEach, describe, expect, test } from 'bun:test'
import i18n from 'i18next'

import { navigationGroups } from '@/components/shell/navigation'
import {
  findCredentialRouteResource,
  normalizeCredentialRouteSearch,
} from '@/features/credentials/credential-route'
import { getUpstreamQuotaWindowDisplayLabel } from '@/features/upstream/quota-format'
import { toManagementApiError } from '@/lib/api/management/client'
import type { CredentialResource } from '@/lib/api/management/credentials'
import { normalizeQuotaCredentialDetail, normalizeQuotaSnapshot } from '@/lib/api/management/quota'
import '@/lib/i18n/i18n'
import { en } from '@/lib/i18n/locales/en'
import { ru } from '@/lib/i18n/locales/ru'
import { zhCN } from '@/lib/i18n/locales/zh-CN'
import { zhTW } from '@/lib/i18n/locales/zh-TW'

function getLeafPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    getLeafPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
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
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[0]!, i18n.t, 'en')).toBe('Weekly')
    expect(detail.windows[1]).toMatchObject({
      label: null,
      periodUnit: 'unknown',
      periodValue: null,
    })
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[1]!, i18n.t, 'en')).toBe(
      'Unknown period',
    )
    expect(detail.windows[2]).toMatchObject({
      periodUnit: 'minute',
      periodValue: 15,
    })
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[2]!, i18n.t, 'en')).toBe('15 minutes')
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

    await i18n.changeLanguage('zh-CN')
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[0]!, i18n.t, 'zh-CN')).toBe('每周')
    expect(getUpstreamQuotaWindowDisplayLabel(detail.windows[1]!, i18n.t, 'zh-CN')).toBe('每月')
    await i18n.changeLanguage('en')
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
