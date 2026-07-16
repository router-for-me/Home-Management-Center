import type {
  QuotaCollectionStatus,
  QuotaCredential,
  QuotaCredentialStatus,
  QuotaCredentialType,
  QuotaDataSource,
  QuotaFreshness,
  QuotaSort,
  QuotaStatus,
  QuotaSummary,
} from '@/lib/api/management/quota'

export type QuotaVerdict = 'healthy' | 'attention' | 'partial'

export type QuotaFilters = {
  search: string
  provider: string
  status: QuotaStatus | 'all'
  freshness: QuotaFreshness | 'all'
  source: QuotaDataSource | 'all'
  credentialStatus: QuotaCredentialStatus | 'all'
  collectionStatus: QuotaCollectionStatus | 'all'
  sort: QuotaSort
}

export type QuotaPagination = {
  limit: number
  offset: number
}

export const quotaPageSizes = [20, 50, 100] as const

export const defaultQuotaPagination: QuotaPagination = {
  limit: quotaPageSizes[0],
  offset: 0,
}

export const defaultQuotaFilters: QuotaFilters = {
  search: '',
  provider: 'all',
  status: 'all',
  freshness: 'all',
  source: 'all',
  credentialStatus: 'all',
  collectionStatus: 'all',
  sort: 'risk_desc',
}

export function getQuotaVerdict(summary: QuotaSummary): QuotaVerdict {
  if (summary.error > 0 || summary.unknown > 0 || summary.unsupported > 0) return 'partial'
  if (summary.exhausted > 0 || summary.low > 0 || summary.stale > 0) return 'attention'
  if (summary.needsAttention > 0) return 'partial'
  return 'healthy'
}

export function supportsAccountCredentialRoute(credentialType: QuotaCredentialType) {
  return credentialType === 'oauth' || credentialType === 'file_auth' || credentialType === 'vertex'
}

export function normalizeQuotaRouteSearch(search: Record<string, unknown>) {
  return {
    q: typeof search.q === 'string' && search.q.trim() ? search.q.trim() : undefined,
  }
}

function getQuotaRiskRank(item: QuotaCredential) {
  if (item.status === 'exhausted') return 0
  if (item.status === 'low') return 1
  if (item.status === 'error' || item.collectionStatus === 'failed') return 2
  if (item.freshness === 'stale' || item.freshness === 'never') return 3
  if (item.status === 'unknown') return 4
  if (item.status === 'unsupported') return 5
  if (item.collectionStatus === 'partial') return 6
  return 7
}

function compareNullableTime(left: string | null, right: string | null, direction: 'asc' | 'desc') {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left)
}

function compareQuotaCredentials(left: QuotaCredential, right: QuotaCredential, sort: QuotaSort) {
  if (sort === 'observed_at_desc' || sort === 'observed_at_asc') {
    const difference = compareNullableTime(
      left.observedAt,
      right.observedAt,
      sort === 'observed_at_desc' ? 'desc' : 'asc',
    )
    if (difference !== 0) return difference
  } else if (sort === 'reset_at_asc') {
    const difference = compareNullableTime(left.earliestResetAt, right.earliestResetAt, 'asc')
    if (difference !== 0) return difference
  } else if (sort === 'provider_asc') {
    const difference = left.provider.localeCompare(right.provider)
    if (difference !== 0) return difference
  } else if (sort === 'label_asc') {
    const difference = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    if (difference !== 0) return difference
  } else {
    const difference = getQuotaRiskRank(left) - getQuotaRiskRank(right)
    if (difference !== 0) return difference
  }

  return left.id.localeCompare(right.id)
}

export function filterAndSortQuotaCredentials(items: QuotaCredential[], filters: QuotaFilters) {
  const normalizedSearch = filters.search.trim().toLowerCase()

  return items
    .filter((item) => {
      if (filters.provider !== 'all' && item.provider !== filters.provider) return false
      if (filters.status !== 'all' && item.status !== filters.status) return false
      if (filters.freshness !== 'all' && item.freshness !== filters.freshness) return false
      if (filters.source !== 'all' && item.source !== filters.source) return false
      if (
        filters.credentialStatus !== 'all' &&
        item.credentialStatus !== filters.credentialStatus
      ) {
        return false
      }
      if (
        filters.collectionStatus !== 'all' &&
        item.collectionStatus !== filters.collectionStatus
      ) {
        return false
      }
      if (!normalizedSearch) return true

      return [item.name, item.authIndex, item.account, item.project, item.provider]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })
    .sort((left, right) => compareQuotaCredentials(left, right, filters.sort))
}

export function getQuotaProviderOptions(items: QuotaCredential[]) {
  return Array.from(new Set(items.map((item) => item.provider))).sort()
}
