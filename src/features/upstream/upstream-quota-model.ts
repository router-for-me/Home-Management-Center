import type { CredentialResource } from '@/lib/api/management/credentials'
import type { QuotaCredential, QuotaStatus, QuotaWindow } from '@/lib/api/management/quota'

export type UpstreamQuotaEntry = QuotaCredential

export type UpstreamQuotaCellState =
  | { kind: 'capability-absent' }
  | { kind: 'loading' }
  | { kind: 'not-collected' }
  | { kind: 'entry'; entry: UpstreamQuotaEntry }

export type UpstreamQuotaView = 'all' | 'attention' | 'ws'

export const xaiOnDemandWindowId = 'xai-on-demand'

export function isQuotaAttentionStatus(status: QuotaStatus) {
  return status === 'low' || status === 'exhausted' || status === 'error'
}

function normalizeJoinKey(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

export function buildUpstreamQuotaJoinMap(
  entries: UpstreamQuotaEntry[],
): Map<string, UpstreamQuotaEntry> {
  const map = new Map<string, UpstreamQuotaEntry>()

  for (const entry of entries) {
    const keys = [normalizeJoinKey(entry.authIndex), normalizeJoinKey(entry.id)]
    for (const key of keys) {
      if (key && !map.has(key)) map.set(key, entry)
    }
  }

  return map
}

export function findUpstreamQuotaEntry(
  map: Map<string, UpstreamQuotaEntry>,
  resource: Pick<CredentialResource, 'authIndex' | 'id' | 'identifier' | 'name'>,
): UpstreamQuotaEntry | null {
  const candidates = [
    normalizeJoinKey(resource.authIndex),
    normalizeJoinKey(resource.id),
    normalizeJoinKey(resource.identifier),
    normalizeJoinKey(resource.name),
  ]

  for (const key of candidates) {
    if (!key) continue
    const entry = map.get(key)
    if (entry) return entry
  }

  return null
}

export function resolveUpstreamQuotaCellState({
  available,
  loading,
  map,
  resource,
}: {
  available: boolean
  loading: boolean
  map: Map<string, UpstreamQuotaEntry>
  resource: Pick<CredentialResource, 'authIndex' | 'id' | 'identifier' | 'name'>
}): UpstreamQuotaCellState {
  if (!available) return { kind: 'capability-absent' }
  if (loading) return { kind: 'loading' }

  const entry = findUpstreamQuotaEntry(map, resource)
  return entry ? { kind: 'entry', entry } : { kind: 'not-collected' }
}

export function findCurrencyWindow(entry: UpstreamQuotaEntry): QuotaWindow | null {
  const windows = [...entry.primaryWindows, ...entry.windows]
  return (
    windows.find(
      (window) => window.unit === 'currency' && !window.id.includes('on-demand'),
    ) ?? null
  )
}

export function findXaiOnDemandWindow(entry: UpstreamQuotaEntry): QuotaWindow | null {
  const windows = [...entry.primaryWindows, ...entry.windows]
  return windows.find((window) => window.id === xaiOnDemandWindowId) ?? null
}
