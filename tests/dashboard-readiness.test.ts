import { describe, expect, test } from 'bun:test'

import { createDashboardOverviewViewModel } from '../src/features/dashboard/dashboard-model'
import type { DashboardSnapshot } from '../src/lib/api/management/dashboard'
import type { CapabilityMap } from '../src/lib/api/management/types'

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
  requestEvents: true,
  requestEventDetails: true,
  requestEventExport: true,
  requestEventFilters: true,
  requestLogIndex: true,
  oauthUsage: true,
  quotaSnapshots: true,
  quotaSnapshotDetails: true,
  logs: true,
  requestErrorLogs: true,
  users: true,
  accessGroups: true,
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
  path: '/codex-api-key',
  responseKey: 'codex-api-key',
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
