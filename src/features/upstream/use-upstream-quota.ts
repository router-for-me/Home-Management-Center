import { useMemo } from 'react'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useManagementSession } from '@/features/observability/use-management-session'
import {
  type QuotaCollectResult,
  fetchQuotaCredentialDetail,
  fetchQuotaSnapshot,
  toQuotaApiError,
  triggerQuotaCollection,
} from '@/lib/api/management/quota'

import { buildUpstreamQuotaJoinMap, isQuotaAttentionStatus } from './upstream-quota-model'

const upstreamQuotaRefreshIntervalMs = 30_000
export const upstreamQuotaListLimit = 200

export function useUpstreamQuota() {
  const { session, connected, connectedAt, capabilityReady, capabilities } = useManagementSession()
  const available = capabilities.quotaSnapshots
  const detailsAvailable = capabilities.quotaSnapshotDetails
  const canQuery = connected && capabilityReady && Boolean(session.managementKey) && available

  const query = useQuery({
    queryKey: ['upstream-quota-snapshot', session.baseUrl, connectedAt],
    enabled: canQuery,
    retry: false,
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: canQuery ? upstreamQuotaRefreshIntervalMs : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      try {
        return await fetchQuotaSnapshot(session, {
          limit: upstreamQuotaListLimit,
          offset: 0,
          sort: 'risk_desc',
        })
      } catch (error) {
        throw toQuotaApiError(error)
      }
    },
  })

  const entries = useMemo(() => query.data?.items ?? [], [query.data])
  const map = useMemo(() => buildUpstreamQuotaJoinMap(entries), [entries])
  const attentionCount = useMemo(
    () => entries.filter((entry) => isQuotaAttentionStatus(entry.status)).length,
    [entries],
  )
  const total = query.data?.total ?? entries.length
  const truncated = total > entries.length

  return {
    available,
    detailsAvailable,
    capabilities,
    map,
    entries,
    attentionCount,
    total,
    truncated,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error ?? null,
    refetch: query.refetch,
    syncQuota: async (): Promise<QuotaCollectResult | null> => {
      if (!capabilities.quotaRecollect) return null
      try {
        return await triggerQuotaCollection(session, {})
      } catch (error) {
        throw toQuotaApiError(error)
      }
    },
  }
}

export function useUpstreamQuotaCredentialDetail(credentialId: string | null) {
  const { session, connected, connectedAt, capabilityReady, capabilities } = useManagementSession()
  const available = capabilities.quotaSnapshotDetails

  const query = useQuery({
    queryKey: ['upstream-quota-credential', session.baseUrl, connectedAt, credentialId],
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
