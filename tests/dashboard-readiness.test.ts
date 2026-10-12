import axios from 'axios'
import { afterEach, describe, expect, test } from 'bun:test'

import { formatClientKeyIdentityLabel } from '../src/features/access-keys/access-key-display'
import { createDashboardOverviewViewModel } from '../src/features/dashboard/dashboard-model'
import type { AccessKeyResource } from '../src/lib/api/management/access-keys'
import {
  type DashboardSnapshot,
  fetchManagementDashboardSnapshot,
} from '../src/lib/api/management/dashboard'
import type { CapabilityMap } from '../src/lib/api/management/types'
import type { UsageAggregateItem, UsageOverview } from '../src/lib/api/management/usage-logs'
import type { UserResource } from '../src/lib/api/management/users'

const capabilities: CapabilityMap = {
  nodes: true,
  topology: true,
  usage: true,
  usageQueue: true,
  usageOverview: true,
  usageRecords: true,
  usageRecordDetails: true,
  usageAggregates: true,
  usageExport: true,
  usageProviderHealth: true,
  usageCredentialHealth: true,
  usageRealtime: true,
  usageTokenBreakdownV2: true,
  requestEvents: true,
  requestEventDetails: true,
  requestEventExport: true,
  requestEventFilters: true,
  requestLogIndex: true,
  oauthUsage: true,
  quotaSnapshots: true,
  quotaSnapshotDetails: true,
  quotaRecollect: false,
  logs: true,
  requestErrorLogs: true,
  users: true,
  accessGroups: true,
  credentialInFlight: true,
  credentialInFlightSnapshotCursor: true,
  credentialConcurrencyLimits: true,
}

function createSnapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    fetchedAt: '2026-07-17T00:00:00Z',
    config: { routing: { strategy: 'round-robin' } },
    latestVersion: null,
    clientKeys: ['client-key'],
    authFiles: [],
    availableModels: { status: 'loaded', count: 1 },
    providers: [],
    nodes: [],
    nodeTopology: null,
    usageOverview: null,
    issues: [],
    ...overrides,
  }
}

const oauthCredential: DashboardSnapshot['authFiles'][number] = {
  id: 'oauth-1',
  provider: 'codex',
  source: 'db',
  status: 'active',
  disabled: false,
  unavailable: false,
}

const providerKey: DashboardSnapshot['providers'][number] = {
  id: 'codex',
  path: '/config/api-keys/codex',
  total: 1,
  active: 1,
  disabled: 0,
}

describe('dashboard runtime readiness', () => {
  test('treats OAuth-only model access as ready without recommending a provider key', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({ authFiles: [oauthCredential], providers: [] }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary).toEqual({ id: 'ready', tone: 'positive' })
    expect(viewModel.recommendedActions.some((action) => action.id === 'configureProviders')).toBe(
      false,
    )
    expect(viewModel.metrics.find((metric) => metric.id === 'providers')?.tone).toBe('neutral')
  })

  test('treats provider-key-only model access as ready without requiring OAuth credentials', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({ authFiles: [], providers: [providerKey] }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary).toEqual({ id: 'ready', tone: 'positive' })
    expect(viewModel.recommendedActions.some((action) => action.id === 'addCredential')).toBe(false)
    expect(viewModel.metrics.find((metric) => metric.id === 'credentials')?.tone).toBe('neutral')
  })

  test('offers both upstream access methods when no models or credentials are configured', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({ availableModels: { status: 'loaded', count: 0 } }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary).toEqual({ id: 'needsUpstreamAccess', tone: 'warning' })
    expect(viewModel.recommendedActions.map((action) => action.id)).toEqual([
      'addCredential',
      'configureProviders',
    ])
  })

  test('reviews existing OAuth credentials when they register no available models', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({
        authFiles: [oauthCredential],
        availableModels: { status: 'loaded', count: 0 },
      }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary).toEqual({ id: 'reviewUpstreamAccess', tone: 'warning' })
    expect(viewModel.recommendedActions.map((action) => action.id)).toEqual(['reviewCredentials'])
  })

  test('does not convert a model availability request failure into a missing-config warning', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({
        availableModels: { status: 'error', count: 0 },
        issues: [{ scope: 'models', message: 'request failed', status: 503 }],
      }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary).toEqual({ id: 'modelStatusUnknown', tone: 'warning' })
    expect(viewModel.recommendedActions[0]?.id).toBe('reviewDataStatus')
  })

  test('requires a client key only after runtime models are available', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({ authFiles: [oauthCredential], clientKeys: [] }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary).toEqual({ id: 'needsClientKey', tone: 'warning' })
    expect(viewModel.recommendedActions[0]?.id).toBe('createClientKey')
  })

  test('keeps the service degraded when models are available but dashboard data is partial', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({
        authFiles: [oauthCredential],
        issues: [{ scope: 'codex', message: 'request failed', status: 500 }],
      }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary).toEqual({ id: 'degraded', tone: 'warning' })
    expect(viewModel.recommendedActions.some((action) => action.id === 'reviewDataStatus')).toBe(
      true,
    )
  })
})

function createUsageItem(overrides: Partial<UsageAggregateItem> = {}): UsageAggregateItem {
  return {
    id: 'api-key-8',
    label: 'api-key-8',
    requestCount: 10,
    successCount: 10,
    failedCount: 0,
    successRate: 1,
    errorRate: 0,
    inputTokens: 100,
    outputTokens: 50,
    reasoningTokens: 0,
    cachedTokens: 0,
    cacheRate: 0,
    totalTokens: 150,
    tokenBreakdown: null,
    totalAmount: null,
    currency: null,
    avgLatencyMs: 120,
    p95LatencyMs: 200,
    lastUsedAt: '2026-08-16T12:00:00Z',
    comparison: null,
    quotaWindows: [],
    metadata: {},
    ...overrides,
  }
}

function createAccessKey(overrides: Partial<AccessKeyResource> = {}): AccessKeyResource {
  return {
    id: '8',
    index: 0,
    numericId: 8,
    identifier: 'api-key-8',
    displayName: null,
    value: 'sk-test-key-8',
    maskedValue: 'sk-tes...key-8',
    prefix: 'sk-tes',
    suffix: 'ey-8',
    length: 13,
    userId: null,
    channelGroupIds: [],
    modelGroupIds: [],
    raw: {},
    ...overrides,
  }
}

function createUser(overrides: Partial<UserResource> = {}): UserResource {
  return {
    id: '1',
    numericId: 1,
    username: 'alice',
    hasPassword: true,
    credits: 100,
    creditsUnlimited: false,
    periodLimits: {
      supported: true,
      creditsUnlimited: false,
      timezone: 'Asia/Shanghai',
      windows: {
        '5h': { limit: null, mode: 'first_use' },
        '1d': { limit: null, mode: 'sliding' },
        '7d': { limit: null, mode: 'calendar' },
        '30d': { limit: null, mode: 'calendar' },
      },
      weekResetDay: 1,
      weekResetHour: 0,
    },
    periodLimitsSummary: null,
    mfaConfigured: false,
    passkeyCount: 0,
    deletedAt: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    raw: {},
    ...overrides,
  }
}

describe('dashboard client key username resolution (Issue #155)', () => {
  test('returns direct username from metadata when provided', () => {
    const item = createUsageItem({ metadata: { username: 'bob' } })
    const label = formatClientKeyIdentityLabel(item, [], [])
    expect(label).toBe('bob')
  })

  test('resolves username from user_id in item metadata', () => {
    const item = createUsageItem({ metadata: { user_id: 1 } })
    const users = [createUser({ numericId: 1, username: 'alice' })]
    const label = formatClientKeyIdentityLabel(item, [], users)
    expect(label).toBe('alice')
  })

  test('resolves username when key in accessKeys is assigned to a user', () => {
    const item = createUsageItem({
      id: 'api-key-8',
      label: 'api-key-8',
      metadata: { api_key_id: 8 },
    })
    const accessKeys = [createAccessKey({ numericId: 8, identifier: 'api-key-8', userId: 1 })]
    const users = [createUser({ numericId: 1, username: 'alice' })]

    const label = formatClientKeyIdentityLabel(item, accessKeys, users)
    expect(label).toBe('alice')
  })

  test('falls back to key display name when key is not assigned to a user', () => {
    const item = createUsageItem({
      id: 'api-key-8',
      label: 'api-key-8',
      metadata: { api_key_id: 8 },
    })
    const accessKeys = [
      createAccessKey({
        numericId: 8,
        identifier: 'api-key-8',
        displayName: 'Production Key',
        userId: null,
      }),
    ]

    const label = formatClientKeyIdentityLabel(item, accessKeys, [])
    expect(label).toBe('Production Key')
  })

  test('falls back to key identifier when key has no displayName and no user', () => {
    const item = createUsageItem({ id: '8', label: 'sk-tes...key-8', metadata: { api_key_id: 8 } })
    const accessKeys = [
      createAccessKey({
        numericId: 8,
        identifier: 'api-key-8',
        displayName: null,
        userId: null,
      }),
    ]

    const label = formatClientKeyIdentityLabel(item, accessKeys, [])
    expect(label).toBe('api-key-8')
  })

  test('falls back to item label when key is unknown', () => {
    const item = createUsageItem({ id: 'unknown-key', label: 'custom-label' })
    const label = formatClientKeyIdentityLabel(item, [], [])
    expect(label).toBe('custom-label')
  })

  test('displays username in keyStatusSummary topClientKeys within dashboard view model', () => {
    const usageOverview: UsageOverview = {
      range: { from: null, to: null, timezone: 'UTC', interval: '1h' },
      live: { rpm: 0, tpm: 0, errorRate: 0, activeRequests: 0 },
      totals: {
        requestCount: 10,
        successCount: 10,
        failedCount: 0,
        successRate: 1,
        errorRate: 0,
        activeModelCount: 1,
        activeCredentialCount: 1,
        activeClientKeyCount: 1,
      },
      trend: [],
      costBreakdown: [],
      modelEfficiency: [],
      top: {
        users: [],
        clientKeys: [
          createUsageItem({
            id: 'api-key-8',
            label: 'api-key-8',
            metadata: { api_key_id: 8, api_key_label: 'api-key-8' },
          }),
        ],
        credentials: [],
        providers: [],
        models: [],
        endpoints: [],
        errors: [],
      },
      activity: [],
    }

    const accessKeys = [createAccessKey({ numericId: 8, identifier: 'api-key-8', userId: 1 })]
    const users = [createUser({ numericId: 1, username: 'charlie' })]

    const snapshot = createSnapshot({
      usageOverview,
      accessKeys,
      users,
    })

    const viewModel = createDashboardOverviewViewModel(snapshot, capabilities, 'home-cluster')

    expect(viewModel.keyStatusSummary.topClientKeys).toHaveLength(1)
    expect(viewModel.keyStatusSummary.topClientKeys[0]?.label).toBe('charlie')
  })
})

describe('fetchManagementDashboardSnapshot integration', () => {
  const defaultAxiosAdapter = axios.defaults.adapter

  afterEach(() => {
    axios.defaults.adapter = defaultAxiosAdapter
  })

  test('enriches snapshot with accessKeys and users', async () => {
    const session = {
      baseUrl: 'http://management.test',
      managementKey: 'test-management-key',
    }

    axios.defaults.adapter = async (config) => {
      const url = config.url ?? ''
      let data: unknown = {}

      if (url.endsWith('/config')) {
        data = { access: { 'api-keys': [] } }
      } else if (url.endsWith('/api-keys')) {
        data = {
          api_key_entries: [
            {
              id: 8,
              api_key: 'sk-test8',
              display_name: 'Key Eight',
              user_id: 1,
            },
          ],
        }
      } else if (url.endsWith('/users')) {
        data = [
          {
            id: 1,
            username: 'dylan',
            password_set: false,
          },
        ]
      } else if (url.endsWith('/models')) {
        data = { models: [{ id: 'gpt-4o' }] }
      } else if (url.endsWith('/credentials')) {
        data = { files: [] }
      }

      return {
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }

    const snapshot = await fetchManagementDashboardSnapshot(session, {
      ...capabilities,
      users: true,
    })

    expect(snapshot.accessKeys).toBeDefined()
    expect(snapshot.accessKeys?.[0]?.numericId).toBe(8)
    expect(snapshot.accessKeys?.[0]?.userId).toBe(1)
    expect(snapshot.users).toBeDefined()
    expect(snapshot.users?.[0]?.username).toBe('dylan')
  })
})
