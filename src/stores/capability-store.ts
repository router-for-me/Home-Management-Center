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
  usage: false,
  usageQueue: false,
  logs: false,
  requestErrorLogs: false,
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
