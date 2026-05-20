import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'

import {
  type DashboardOverviewViewModel,
  createDashboardOverviewViewModel,
} from '@/features/dashboard/dashboard-model'
import { toManagementApiError } from '@/lib/api/management/client'
import { fetchManagementDashboardSnapshot } from '@/lib/api/management/dashboard'
import type { DashboardSnapshot } from '@/lib/api/management/dashboard'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

type DashboardOverviewQueryState = {
  connected: boolean
  capabilityReady: boolean
  snapshot: DashboardSnapshot | undefined
  viewModel: DashboardOverviewViewModel | null
  isPending: boolean
  isFetching: boolean
  isError: boolean
  errorMessage: string | null
  refetch: () => void
}

export function useDashboardOverview(): DashboardOverviewQueryState {
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connectedAt = useSessionStore((state) => state.connectedAt)
  const sessionStatus = useSessionStore((state) => state.status)
  const capabilityStatus = useCapabilityStore((state) => state.status)
  const capabilities = useCapabilityStore((state) => state.capabilities)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)
  const connected = sessionStatus === 'connected'
  const capabilityReady = capabilityStatus === 'ready'

  const query = useQuery({
    queryKey: [
      'management-dashboard-overview',
      baseUrl,
      connectedAt,
      capabilityStatus,
      capabilities.nodes,
      capabilities.usage,
      capabilities.usageQueue,
      capabilities.logs,
      capabilities.requestErrorLogs,
    ],
    enabled: connected && capabilityReady && Boolean(managementKey),
    queryFn: async () => {
      try {
        return await fetchManagementDashboardSnapshot(
          {
            baseUrl,
            managementKey,
          },
          capabilities,
        )
      } catch (error) {
        const apiError = toManagementApiError(error)
        throw new Error(apiError.message, { cause: error })
      }
    },
  })

  const viewModel = useMemo(
    () =>
      query.data ? createDashboardOverviewViewModel(query.data, capabilities, runtimeMode) : null,
    [capabilities, query.data, runtimeMode],
  )

  return {
    connected,
    capabilityReady,
    snapshot: query.data,
    viewModel,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    errorMessage: query.error?.message ?? null,
    refetch: () => {
      void query.refetch()
    },
  }
}
