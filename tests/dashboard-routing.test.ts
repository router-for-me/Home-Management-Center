import { describe, expect, test } from 'bun:test'

import { createDashboardOverviewViewModel } from '../src/features/dashboard/dashboard-model'
import type { DashboardSnapshot } from '../src/lib/api/management/dashboard'
import {
  normalizeManagementRoutingStrategy,
  readManagementRoutingStrategy,
} from '../src/lib/api/management/routing'
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

function createSnapshot(config: Record<string, unknown>): DashboardSnapshot {
  return {
    fetchedAt: '2026-07-14T00:00:00Z',
    config,
    latestVersion: null,
    clientKeys: ['client-key'],
    authFiles: [
      {
        id: 'auth-1',
        provider: 'openai',
        source: 'file',
        status: 'ready',
        disabled: false,
        unavailable: false,
      },
    ],
    availableModels: {
      status: 'loaded',
      count: 1,
    },
    providers: [
      {
        id: 'codex',
        path: '/config/api-keys/codex',
        total: 1,
        active: 1,
        disabled: 0,
      },
    ],
    nodes: [],
    nodeTopology: null,
    usageOverview: null,
    issues: [],
  }
}

describe('management routing strategy normalization', () => {
  test('treats an omitted strategy as the backend round-robin default', () => {
    expect(readManagementRoutingStrategy({ routing: {} })).toBe('round-robin')
    expect(readManagementRoutingStrategy({})).toBe('round-robin')
    expect(normalizeManagementRoutingStrategy('')).toBe('round-robin')
  })

  test('normalizes supported aliases and rejects malformed values', () => {
    expect(normalizeManagementRoutingStrategy(' RR ')).toBe('round-robin')
    expect(normalizeManagementRoutingStrategy('fillfirst')).toBe('fill-first')
    expect(normalizeManagementRoutingStrategy('least-loaded')).toBe('unknown')
    expect(readManagementRoutingStrategy({ routing: null })).toBe('unknown')
  })

  test('does not recommend a routing check for the valid empty-object response', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({ routing: {} }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary.id).toBe('ready')
    expect(viewModel.configChecks.find((item) => item.id === 'routing')).toMatchObject({
      enabled: true,
      value: 'round-robin',
      tone: 'positive',
    })
    expect(viewModel.recommendedActions.some((action) => action.id === 'checkRouting')).toBe(false)
  })

  test('keeps warning for an unsupported routing strategy', () => {
    const viewModel = createDashboardOverviewViewModel(
      createSnapshot({ routing: { strategy: 'least-loaded' } }),
      capabilities,
      'home-cluster',
    )

    expect(viewModel.healthSummary.id).toBe('degraded')
    expect(viewModel.recommendedActions.some((action) => action.id === 'checkRouting')).toBe(true)
  })
})
