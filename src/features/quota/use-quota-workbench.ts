import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useManagementSession } from '@/features/observability/use-management-session'
import { type QuotaFilters, type QuotaPagination } from '@/features/quota/quota-model'
import {
  fetchQuotaCredentialDetail,
  fetchQuotaSnapshot,
  toQuotaApiError,
} from '@/lib/api/management/quota'

const quotaRefreshIntervalMs = 30_000

export function useQuotaWorkbench(filters: QuotaFilters, pagination: QuotaPagination) {
  const { session, connected, checking, connectedAt, capabilityReady, capabilities, runtimeMode } =
    useManagementSession()
  const available = capabilities.quotaSnapshots
  const canQuery = connected && capabilityReady && Boolean(session.managementKey) && available

  const query = useQuery({
    queryKey: ['management-quota-snapshots', session.baseUrl, connectedAt, filters, pagination],
    enabled: canQuery,
    retry: false,
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: canQuery ? quotaRefreshIntervalMs : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchQuotaSnapshot(session, {
          limit: pagination.limit,
          offset: pagination.offset,
          search: filters.search.trim() || undefined,
          provider: filters.provider === 'all' ? undefined : filters.provider,
          quotaStatus: filters.status === 'all' ? undefined : filters.status,
          freshness: filters.freshness === 'all' ? undefined : filters.freshness,
          source: filters.source === 'all' ? undefined : filters.source,
          credentialStatus:
            filters.credentialStatus === 'all' ? undefined : filters.credentialStatus,
          collectionStatus:
            filters.collectionStatus === 'all' ? undefined : filters.collectionStatus,
          sort: filters.sort,
        })
      } catch (error) {
        throw toQuotaApiError(error)
      }
    },
  })

  return {
    connected,
    checking,
    capabilityReady,
    capabilities,
    runtimeMode,
    available,
    snapshot: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
  }
}

export function useQuotaCredentialDetail(credentialId: string | null) {
  const { session, connected, connectedAt, capabilityReady, capabilities } = useManagementSession()
  const available = capabilities.quotaSnapshotDetails

  const query = useQuery({
    queryKey: ['management-quota-credential', session.baseUrl, connectedAt, credentialId],
    enabled:
      Boolean(credentialId) &&
      connected &&
      capabilityReady &&
      Boolean(session.managementKey) &&
      available,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!credentialId) throw new Error('Credential ID is required')

      try {
        return await fetchQuotaCredentialDetail(session, credentialId)
      } catch (error) {
        throw toQuotaApiError(error)
      }
    },
  })

  return {
    available,
    item: query.data ?? null,
    isPending: available && query.isPending,
    isError: query.isError,
    error: query.error ?? null,
  }
}
