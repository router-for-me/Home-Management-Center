import { useEffect, useRef, useState } from 'react'

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { getAdaptiveRefreshInterval } from '@/features/observability/live-refresh'
import { useLiveRefresh } from '@/features/observability/use-live-refresh'
import { useManagementSession } from '@/features/observability/use-management-session'
import { downloadRequestLogById, toLogsApiError } from '@/lib/api/management/logs'
import {
  defaultUsageFilters,
  fetchRequestLogIndex,
  fetchUsageCredentialHealth,
  fetchUsageOverview,
  fetchUsageProviderHealth,
  fetchUsageRealtime,
  fetchUsageRuntimeSettings,
  toUsageApiError,
} from '@/lib/api/management/usage'
import type { UsageLogIssue, UsageSnapshot } from '@/lib/api/management/usage'

const realtimeRefreshMs = 10_000
const requestLogsRefreshMs = 20_000
const healthRefreshMs = 30_000
const overviewRefreshMs = 60_000
const settingsRefreshMs = 5 * 60_000

function toIssue(scope: UsageLogIssue['scope'], error: Error | null): UsageLogIssue | null {
  if (!error) return null
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null
  return {
    scope,
    message: error.message,
    ...(status === null ? {} : { status }),
  }
}

export function useCallDiagnosticsWorkbench() {
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const canQuery = connected && capabilityReady && Boolean(session.managementKey)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [requestLogsAutoRefreshEligible, setRequestLogsAutoRefreshEligible] = useState(true)
  const hasCapability =
    capabilities.usageOverview ||
    capabilities.usageProviderHealth ||
    capabilities.usageCredentialHealth ||
    capabilities.usageRealtime ||
    capabilities.requestLogIndex
  const autoRefresh = useLiveRefresh({
    storageKey: 'hmc:call-diagnostics:auto-refresh',
    defaultEnabled: true,
    eligible: canQuery && hasCapability,
    ineligibleReason: 'unavailable',
  })

  const settingsQuery = useQuery({
    queryKey: ['management-diagnostics-settings', session.baseUrl, connectedAt],
    enabled: canQuery,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: autoRefresh.active ? getAdaptiveRefreshInterval(settingsRefreshMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageRuntimeSettings(session)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const overviewQuery = useQuery({
    queryKey: ['management-diagnostics-overview', session.baseUrl, connectedAt],
    enabled: canQuery && capabilities.usageOverview,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: autoRefresh.active ? getAdaptiveRefreshInterval(overviewRefreshMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageOverview(session, defaultUsageFilters)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const providerHealthQuery = useQuery({
    queryKey: ['management-diagnostics-provider-health', session.baseUrl, connectedAt],
    enabled: canQuery && capabilities.usageProviderHealth,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: autoRefresh.active ? getAdaptiveRefreshInterval(healthRefreshMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageProviderHealth(session, defaultUsageFilters)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const credentialHealthQuery = useQuery({
    queryKey: ['management-diagnostics-credential-health', session.baseUrl, connectedAt],
    enabled: canQuery && capabilities.usageCredentialHealth,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: autoRefresh.active ? getAdaptiveRefreshInterval(healthRefreshMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageCredentialHealth(session, defaultUsageFilters)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const realtimeQuery = useQuery({
    queryKey: ['management-diagnostics-realtime', session.baseUrl, connectedAt],
    enabled: canQuery && capabilities.usageRealtime,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: autoRefresh.active ? getAdaptiveRefreshInterval(realtimeRefreshMs) : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchUsageRealtime(session, defaultUsageFilters)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const requestLogsQuery = useQuery({
    queryKey: ['management-diagnostics-request-logs', session.baseUrl, connectedAt],
    enabled: canQuery && capabilities.requestLogIndex,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval:
      autoRefresh.active && requestLogsAutoRefreshEligible
        ? getAdaptiveRefreshInterval(requestLogsRefreshMs)
        : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchRequestLogIndex(session, defaultUsageFilters)
      } catch (error) {
        throw toUsageApiError(error)
      }
    },
  })

  const queries = [
    settingsQuery,
    overviewQuery,
    providerHealthQuery,
    credentialHealthQuery,
    realtimeQuery,
    requestLogsQuery,
  ]
  const wasAutoRefreshActive = useRef(autoRefresh.active)

  useEffect(() => {
    if (autoRefresh.active && !wasAutoRefreshActive.current && canQuery) {
      const refreshes: Array<Promise<unknown>> = [settingsQuery.refetch()]
      if (capabilities.usageOverview) refreshes.push(overviewQuery.refetch())
      if (capabilities.usageProviderHealth) refreshes.push(providerHealthQuery.refetch())
      if (capabilities.usageCredentialHealth) refreshes.push(credentialHealthQuery.refetch())
      if (capabilities.usageRealtime) refreshes.push(realtimeQuery.refetch())
      if (capabilities.requestLogIndex && requestLogsAutoRefreshEligible) {
        refreshes.push(requestLogsQuery.refetch())
      }
      void Promise.allSettled(refreshes)
    }
    wasAutoRefreshActive.current = autoRefresh.active
  }, [
    autoRefresh.active,
    canQuery,
    capabilities.requestLogIndex,
    capabilities.usageCredentialHealth,
    capabilities.usageOverview,
    capabilities.usageProviderHealth,
    capabilities.usageRealtime,
    credentialHealthQuery,
    overviewQuery,
    providerHealthQuery,
    realtimeQuery,
    requestLogsQuery,
    requestLogsAutoRefreshEligible,
    settingsQuery,
  ])

  const issues = [
    toIssue('runtimeSettings', settingsQuery.error),
    toIssue('usageOverview', overviewQuery.error),
    toIssue('usageProviderHealth', providerHealthQuery.error),
    toIssue('usageCredentialHealth', credentialHealthQuery.error),
    toIssue('usageRealtime', realtimeQuery.error),
    toIssue('requestLogIndex', requestLogsQuery.error),
  ].filter((issue): issue is UsageLogIssue => issue !== null)
  const dataUpdatedAt = Math.max(...queries.map((query) => query.dataUpdatedAt), 0)
  const primaryRefresh = capabilities.usageRealtime
    ? { intervalMs: realtimeRefreshMs, updatedAt: realtimeQuery.dataUpdatedAt }
    : capabilities.requestLogIndex
      ? { intervalMs: requestLogsRefreshMs, updatedAt: requestLogsQuery.dataUpdatedAt }
      : capabilities.usageProviderHealth || capabilities.usageCredentialHealth
        ? {
            intervalMs: healthRefreshMs,
            updatedAt: Math.max(
              providerHealthQuery.dataUpdatedAt,
              credentialHealthQuery.dataUpdatedAt,
            ),
          }
        : capabilities.usageOverview
          ? { intervalMs: overviewRefreshMs, updatedAt: overviewQuery.dataUpdatedAt }
          : { intervalMs: settingsRefreshMs, updatedAt: settingsQuery.dataUpdatedAt }
  const toUpdatedAt = (value: number) => (value > 0 ? new Date(value).toISOString() : null)
  const hasData = queries.some((query) => query.data !== undefined)
  const snapshot: UsageSnapshot | undefined = hasData
    ? {
        fetchedAt: new Date(dataUpdatedAt || Date.now()).toISOString(),
        settings: settingsQuery.data ?? {
          usageStatisticsEnabled: false,
          fileLoggingEnabled: false,
        },
        overview: overviewQuery.data ?? null,
        records: null,
        credentialUsage: null,
        providerHealth: providerHealthQuery.data ?? null,
        credentialHealth: credentialHealthQuery.data ?? null,
        realtime: realtimeQuery.data ?? null,
        requestLogs: requestLogsQuery.data ?? null,
        apiKeyUsage: [],
        runtimeLogs: null,
        requestErrorLogs: [],
        filterOptions: {
          providers: [],
          models: [],
          credentialTypes: [],
          homeIps: [],
          endpoints: [],
          executorTypes: [],
          statusCodes: [],
        },
        issues,
      }
    : undefined

  const downloadRequestLogByIdMutation = useMutation({
    mutationFn: async ({
      requestId,
      homeIp,
      homePort,
    }: {
      requestId: string
      homeIp?: string | null
      homePort?: number | null
    }) => {
      try {
        return await downloadRequestLogById(session, requestId, homeIp, homePort)
      } catch (error) {
        throw toLogsApiError(error)
      }
    },
  })

  return {
    connected,
    checking,
    capabilityReady,
    capabilities,
    runtimeMode,
    snapshot,
    autoRefresh,
    autoRefreshIntervalMs: primaryRefresh.intervalMs,
    autoRefreshError: issues.length > 0,
    autoRefreshLastSuccessAt: primaryRefresh.updatedAt || null,
    updatedAt: {
      overview: toUpdatedAt(overviewQuery.dataUpdatedAt),
      providerHealth: toUpdatedAt(providerHealthQuery.dataUpdatedAt),
      credentialHealth: toUpdatedAt(credentialHealthQuery.dataUpdatedAt),
      realtime: toUpdatedAt(realtimeQuery.dataUpdatedAt),
      requestLogs: toUpdatedAt(requestLogsQuery.dataUpdatedAt),
    },
    setRequestLogsAutoRefreshEligible,
    isPending:
      settingsQuery.isPending ||
      (capabilities.usageOverview && overviewQuery.isPending) ||
      (capabilities.usageProviderHealth && providerHealthQuery.isPending) ||
      (capabilities.usageCredentialHealth && credentialHealthQuery.isPending) ||
      (capabilities.usageRealtime && realtimeQuery.isPending) ||
      (capabilities.requestLogIndex && requestLogsQuery.isPending),
    isFetching: queries.some((query) => query.isFetching),
    manualRefreshing,
    isError: !snapshot && queries.some((query) => query.isError),
    errorMessage: settingsQuery.error?.message ?? issues[0]?.message ?? null,
    refetch: () => {
      if (!canQuery) return
      setManualRefreshing(true)
      const refreshes: Array<Promise<unknown>> = [settingsQuery.refetch()]
      if (capabilities.usageOverview) refreshes.push(overviewQuery.refetch())
      if (capabilities.usageProviderHealth) refreshes.push(providerHealthQuery.refetch())
      if (capabilities.usageCredentialHealth) refreshes.push(credentialHealthQuery.refetch())
      if (capabilities.usageRealtime) refreshes.push(realtimeQuery.refetch())
      if (capabilities.requestLogIndex) refreshes.push(requestLogsQuery.refetch())
      void Promise.allSettled(refreshes).finally(() => setManualRefreshing(false))
    },
    downloadRequestLogById: downloadRequestLogByIdMutation.mutateAsync,
    downloadingRequestLogId: downloadRequestLogByIdMutation.variables?.requestId ?? null,
    isDownloadingRequestLog: downloadRequestLogByIdMutation.isPending,
    mutating: downloadRequestLogByIdMutation.isPending,
  }
}
