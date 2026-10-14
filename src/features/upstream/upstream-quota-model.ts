import type { CredentialResource } from '@/lib/api/management/credentials'
import type { QuotaCredential, QuotaWindow } from '@/lib/api/management/quota'

export type UpstreamQuotaEntry = QuotaCredential

export type UpstreamQuotaCellState =
  | { kind: 'capability-absent' }
  | { kind: 'loading' }
  | { kind: 'not-collected' }
  // The credential is past the risk-sorted snapshot page the console fetched, so
  // its quota exists on the backend but was not loaded — not the same as a
  // credential that was never collected.
  | { kind: 'snapshot-miss' }
  | { kind: 'entry'; entry: UpstreamQuotaEntry }

export type AntigravityQuotaGroupId = 'gemini' | 'third-party'

export type AntigravityQuotaGroup = {
  id: AntigravityQuotaGroupId
  windows: QuotaWindow[]
}

type AntigravityQuotaPresentation =
  | { kind: 'windows'; groups: AntigravityQuotaGroup[] }
  | { kind: 'collecting'; groups: [] }
  | { kind: 'failed'; groups: [] }
  | { kind: 'legacy'; groups: [] }
  | { kind: 'not-collected'; groups: [] }

type UpstreamQuotaCollectionProgress = {
  completedCount: number
  collectingCount: number
  candidateCount: number
}

type UpstreamQuotaCollectionBaselineEntry = {
  lastAttemptAt: string | null
}

const xaiOnDemandWindowId = 'xai-on-demand'
const xaiWeeklyWindowId = 'xai-weekly-usage'

const antigravityQuotaGroupOrder: AntigravityQuotaGroupId[] = ['gemini', 'third-party']

export function isQuotaAttentionEntry(
  entry: Pick<UpstreamQuotaEntry, 'status' | 'freshness' | 'collectionStatus'>,
) {
  return (
    entry.status !== 'healthy' ||
    entry.freshness !== 'fresh' ||
    entry.collectionStatus === 'partial' ||
    entry.collectionStatus === 'failed'
  )
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

/**
 * Count attention entries through the credential-list join. The backend's
 * global summary spans every auth record (including provider API keys and
 * other non-OAuth auths), which the credential list can never display, so the
 * card must count what the attention filter can actually show.
 */
export function countUpstreamQuotaAttentionResources(
  resources: readonly Pick<CredentialResource, 'authIndex' | 'id' | 'identifier' | 'name'>[],
  map: Map<string, UpstreamQuotaEntry>,
) {
  let count = 0
  for (const resource of resources) {
    const entry = findUpstreamQuotaEntry(map, resource)
    if (entry && isQuotaAttentionEntry(entry)) count += 1
  }
  return count
}

export function resolveUpstreamQuotaCellState({
  available,
  loading,
  truncated,
  map,
  resource,
}: {
  available: boolean
  loading: boolean
  truncated: boolean
  map: Map<string, UpstreamQuotaEntry>
  resource: Pick<CredentialResource, 'authIndex' | 'id' | 'identifier' | 'name'>
}): UpstreamQuotaCellState {
  if (!available) return { kind: 'capability-absent' }
  if (loading) return { kind: 'loading' }

  const entry = findUpstreamQuotaEntry(map, resource)
  if (entry) return { kind: 'entry', entry }
  return { kind: truncated ? 'snapshot-miss' : 'not-collected' }
}

const quotaCollectableProviders = new Set(['claude', 'antigravity', 'codex', 'kimi', 'xai', 'grok'])

export function isCredentialQuotaCollectable(
  resource: Pick<CredentialResource, 'provider' | 'disabled' | 'status'>,
) {
  if (resource.disabled || resource.status === 'disabled') return false
  const provider = resource.provider.trim().toLowerCase()
  return quotaCollectableProviders.has(provider)
}

export function findCurrencyWindow(entry: UpstreamQuotaEntry): QuotaWindow | null {
  const windows = [...entry.primaryWindows, ...entry.windows]
  return (
    windows.find((window) => window.unit === 'currency' && !window.id.includes('on-demand')) ?? null
  )
}

export function findXaiOnDemandWindow(entry: UpstreamQuotaEntry): QuotaWindow | null {
  const windows = [...entry.primaryWindows, ...entry.windows]
  return windows.find((window) => window.id === xaiOnDemandWindowId) ?? null
}

export function findXaiWeeklyWindow(entry: UpstreamQuotaEntry): QuotaWindow | null {
  const windows = [...entry.primaryWindows, ...entry.windows]
  return windows.find((window) => window.id === xaiWeeklyWindowId) ?? null
}

function normalizeAntigravityQuotaGroupId(
  value: string | null | undefined,
): AntigravityQuotaGroupId | null {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'gemini' || normalized === 'third-party' ? normalized : null
}

function antigravityQuotaWindowOrder(window: QuotaWindow) {
  if (window.periodUnit === 'hour' && window.periodValue === 5) return 0
  if (window.periodUnit === 'week' && window.periodValue === 1) return 1
  return 2
}

export function groupAntigravityQuotaWindows(windows: QuotaWindow[]): AntigravityQuotaGroup[] {
  const grouped = new Map<AntigravityQuotaGroupId, QuotaWindow[]>()
  const seenWindowIds = new Set<string>()

  for (const window of windows) {
    const groupId = normalizeAntigravityQuotaGroupId(window.scopeId)
    if (!groupId || seenWindowIds.has(window.id)) continue
    seenWindowIds.add(window.id)
    const groupWindows = grouped.get(groupId) ?? []
    groupWindows.push(window)
    grouped.set(groupId, groupWindows)
  }

  return antigravityQuotaGroupOrder.flatMap((id) => {
    const groupWindows = grouped.get(id)
    if (!groupWindows?.length) return []
    return [
      {
        id,
        windows: [...groupWindows].sort((left, right) => {
          const order = antigravityQuotaWindowOrder(left) - antigravityQuotaWindowOrder(right)
          return order || left.id.localeCompare(right.id)
        }),
      },
    ]
  })
}

export function resolveAntigravityQuotaPresentation(
  entry: Pick<
    UpstreamQuotaEntry,
    'collectionStatus' | 'freshness' | 'lastAttemptAt' | 'status' | 'windowCount'
  >,
  windows: QuotaWindow[],
): AntigravityQuotaPresentation {
  const groups = groupAntigravityQuotaWindows(windows)
  if (groups.length > 0) return { kind: 'windows', groups }

  if (entry.collectionStatus === 'collecting') return { kind: 'collecting', groups: [] }
  if (entry.collectionStatus === 'failed' || entry.status === 'error') {
    return { kind: 'failed', groups: [] }
  }
  if (entry.freshness === 'never' && entry.windowCount === 0 && entry.lastAttemptAt === null) {
    return { kind: 'not-collected', groups: [] }
  }
  return { kind: 'legacy', groups: [] }
}
