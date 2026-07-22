import type { CredentialResource } from '@/lib/api/management/credentials'
import type { QuotaCredential, QuotaStatus, QuotaWindow } from '@/lib/api/management/quota'

export type UpstreamQuotaEntry = QuotaCredential

export type UpstreamQuotaCellState =
  | { kind: 'capability-absent' }
  | { kind: 'loading' }
  | { kind: 'not-collected' }
  | { kind: 'entry'; entry: UpstreamQuotaEntry }

export type UpstreamQuotaView = 'all' | 'attention' | 'ws'

type UpstreamQuotaCollectionProgress = {
  completedCount: number
  collectingCount: number
  candidateCount: number
}

type UpstreamQuotaCollectionBaselineEntry = {
  lastAttemptAt: string | null
}

export const xaiOnDemandWindowId = 'xai-on-demand'

export function isQuotaAttentionStatus(status: QuotaStatus) {
  return status === 'low' || status === 'exhausted' || status === 'error'
}

function isQuotaCollectionCandidate(entry: UpstreamQuotaEntry) {
  return (
    entry.credentialStatus === 'enabled' &&
    entry.collectionStatus !== 'unsupported' &&
    entry.status !== 'unsupported'
  )
}

function hasNewActiveProbeResult(
  entry: UpstreamQuotaEntry,
  baseline: UpstreamQuotaCollectionBaselineEntry | undefined,
) {
  if (!baseline || entry.lastAttemptAt === baseline.lastAttemptAt) return false
  if (entry.collectionStatus === 'collecting') return false
  if (
    entry.collectionStatus !== 'success' &&
    entry.collectionStatus !== 'partial' &&
    entry.collectionStatus !== 'failed'
  ) {
    return false
  }
  return (
    entry.collectionStatus === 'failed' ||
    entry.source === 'active_probe' ||
    entry.source === 'mixed'
  )
}

export function createUpstreamQuotaCollectionBaseline(entries: UpstreamQuotaEntry[]) {
  return new Map(
    entries.map((entry) => [entry.id, { lastAttemptAt: entry.lastAttemptAt }] as const),
  )
}

export function getUpstreamQuotaCollectionProgress(
  entries: UpstreamQuotaEntry[],
  baseline: ReadonlyMap<string, UpstreamQuotaCollectionBaselineEntry>,
): UpstreamQuotaCollectionProgress {
  let completedCount = 0
  let collectingCount = 0
  let candidateCount = 0

  for (const entry of entries) {
    if (!isQuotaCollectionCandidate(entry)) continue
    candidateCount += 1
    if (entry.collectionStatus === 'collecting') collectingCount += 1
    if (hasNewActiveProbeResult(entry, baseline.get(entry.id))) completedCount += 1
  }

  return { completedCount, collectingCount, candidateCount }
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
