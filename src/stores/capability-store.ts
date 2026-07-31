import { create } from 'zustand'

import type {
  CapabilityMap,
  CapabilityProbeResult,
  ManagementApiError,
  ManagementServerInfo,
  RuntimeMode,
} from '@/lib/api/management/types'

const emptyCapabilities: CapabilityMap = {
  nodes: false,
  topology: false,
  usage: false,
  usageQueue: false,
  usageOverview: false,
  usageRecords: false,
  usageRecordDetails: false,
  usageAggregates: false,
  usageExport: false,
  usageProviderHealth: false,
  usageCredentialHealth: false,
  usageRealtime: false,
  usageTokenBreakdownV2: false,
  requestEvents: false,
  requestEventDetails: false,
  requestEventExport: false,
  requestEventFilters: false,
  requestLogIndex: false,
  oauthUsage: false,
  quotaSnapshots: false,
  quotaSnapshotDetails: false,
  quotaRecollect: false,
  logs: false,
  requestErrorLogs: false,
  users: false,
  userPeriodLimits: false,
  accessGroups: false,
  modelChannelBindings: false,
  credentialInFlight: false,
  credentialInFlightSnapshotCursor: false,
  credentialConcurrencyLimits: false,
}

type CapabilityStatus = 'idle' | 'probing' | 'ready' | 'error'

type CapabilityState = {
  status: CapabilityStatus
  capabilities: CapabilityMap
  runtimeMode: RuntimeMode
  serverInfo: ManagementServerInfo
  probedAt: string | null
  error: ManagementApiError | null
  setProbing: () => void
  setProbeResult: (result: CapabilityProbeResult) => void
  setUsageTokenBreakdownV2: (available: boolean) => void
  setError: (error: ManagementApiError) => void
  reset: () => void
}

export const useCapabilityStore = create<CapabilityState>((set) => ({
  status: 'idle',
  capabilities: emptyCapabilities,
  runtimeMode: 'unknown',
  serverInfo: {},
  probedAt: null,
  error: null,
  setProbing: () =>
    set({
      status: 'probing',
      error: null,
    }),
  setProbeResult: (result) =>
    set({
      status: 'ready',
      capabilities: result.capabilities,
      runtimeMode: result.runtimeMode,
      serverInfo: result.serverInfo,
      probedAt: result.probedAt,
      error: null,
    }),
  setUsageTokenBreakdownV2: (available) =>
    set((state) =>
      state.capabilities.usageTokenBreakdownV2 === available
        ? state
        : {
            capabilities: {
              ...state.capabilities,
              usageTokenBreakdownV2: available,
            },
          },
    ),
  setError: (error) =>
    set({
      status: 'error',
      error,
    }),
  reset: () =>
    set({
      status: 'idle',
      capabilities: emptyCapabilities,
      runtimeMode: 'unknown',
      serverInfo: {},
      probedAt: null,
      error: null,
    }),
}))
