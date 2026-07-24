import { getCredentialDisplayName } from '@/features/credentials/credential-display'
import {
  type UpstreamQuotaEntry,
  findUpstreamQuotaEntry,
  isQuotaAttentionEntry,
} from '@/features/upstream/upstream-quota-model'
import type { CredentialResource, CredentialStatusFilter } from '@/lib/api/management/credentials'

export type CredentialFilterState = {
  search: string
  statusFilter: CredentialStatusFilter
  providerFilter: string
  quotaAvailable: boolean
  attentionOnly: boolean
  websocketOnly: boolean
}

export function hasCredentialFilters({
  search,
  statusFilter,
  providerFilter,
  quotaAvailable,
  attentionOnly,
  websocketOnly,
}: CredentialFilterState) {
  return (
    search.trim().length > 0 ||
    statusFilter !== 'all' ||
    providerFilter !== 'all' ||
    (quotaAvailable && attentionOnly) ||
    websocketOnly
  )
}

export function filterCredentialResources(
  resources: CredentialResource[],
  quotaMap: Map<string, UpstreamQuotaEntry>,
  {
    search,
    statusFilter,
    providerFilter,
    quotaAvailable,
    attentionOnly,
    websocketOnly,
  }: CredentialFilterState,
) {
  const normalizedSearch = search.trim().toLowerCase()

  return resources.filter((resource) => {
    if (statusFilter === 'active' && (resource.disabled || resource.unavailable)) return false
    if (statusFilter === 'disabled' && !resource.disabled) return false
    if (statusFilter === 'unavailable' && !resource.unavailable) return false
    if (providerFilter !== 'all' && resource.provider !== providerFilter) return false
    if (quotaAvailable && attentionOnly) {
      const entry = findUpstreamQuotaEntry(quotaMap, resource)
      if (!entry || !isQuotaAttentionEntry(entry)) return false
    }
    if (websocketOnly && !resource.websockets) return false
    if (!normalizedSearch) return true

    return [
      getCredentialDisplayName(resource),
      resource.name,
      resource.authIndex,
      resource.email,
      resource.account,
      resource.provider,
      resource.type,
      resource.note,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch))
  })
}
