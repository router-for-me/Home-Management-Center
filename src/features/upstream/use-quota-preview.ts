import { useEffect, useRef, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { useManagementSession } from '@/features/observability/use-management-session'
import { type QuotaCredential, fetchQuotaCredentialDetail } from '@/lib/api/management/quota'

import { needsQuotaPreviewDetail, resolveQuotaPreviewEntry } from './quota-preview-model'

export function useQuotaPreview(entry: QuotaCredential | null) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const { session, connected, connectedAt, capabilityReady, capabilities } = useManagementSession()
  const requestedVersion = useRef('')

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([item]) => setVisible(Boolean(item?.isIntersecting)))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const enabled = Boolean(
    entry &&
    visible &&
    connected &&
    capabilityReady &&
    session.managementKey &&
    capabilities.quotaSnapshotDetails &&
    needsQuotaPreviewDetail(entry),
  )
  const query = useQuery({
    queryKey: ['upstream-quota-credential', session.baseUrl, connectedAt, entry?.id ?? null],
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) => fetchQuotaCredentialDetail(session, entry!.id, signal),
  })
  const item =
    entry && needsQuotaPreviewDetail(entry)
      ? resolveQuotaPreviewEntry(entry, query.data ?? null)
      : entry
  const version = JSON.stringify([
    session.baseUrl,
    connectedAt,
    entry?.id,
    entry?.observedAt,
    entry?.lastAttemptAt,
    entry?.collectionStatus,
  ])
  const { data, isFetching, refetch } = query

  useEffect(() => {
    if (!enabled) return
    if (isFetching) requestedVersion.current = version
    // Re-read a changed snapshot once; never combine its values with an older detail response.
    if (data && item === entry && requestedVersion.current !== version) {
      requestedVersion.current = version
      void refetch({ cancelRefetch: false })
    }
  }, [data, enabled, entry, isFetching, item, refetch, version])

  return {
    ref,
    entry: item,
    loading: enabled && query.isPending,
    failed: query.isError && Boolean(item && needsQuotaPreviewDetail(item)),
  }
}
