export type LiveRefreshPauseReason =
  | 'disabled'
  | 'hidden'
  | 'offline'
  | 'detail'
  | 'nonFirstPage'
  | 'historicalRange'
  | 'nonLatestSort'
  | 'invalidFilters'
  | 'unavailable'
  | 'ineligible'

export type StagedRefresh<T> = {
  data: T
  count: number
  truncated: boolean
}

export function getAdaptiveRefreshInterval(baseIntervalMs: number, maxIntervalMs = 60_000) {
  return (query: { state: { error: Error | null; fetchFailureCount: number } }) => {
    const status =
      query.state.error && typeof query.state.error === 'object'
        ? (query.state.error as { status?: unknown }).status
        : null
    if (status === 404 || status === 405) return false

    const exponent = Math.min(query.state.fetchFailureCount, 4)
    return Math.min(baseIntervalMs * 2 ** exponent, Math.max(baseIntervalMs, maxIntervalMs))
  }
}

export function getStagedItemCount<T>(
  acceptedItems: T[],
  incomingItems: T[],
  getId: (item: T) => string,
  probeLimit: number,
) {
  if (incomingItems.length === 0) return { count: 0, truncated: false }
  if (acceptedItems.length === 0) {
    return {
      count: incomingItems.length,
      truncated: incomingItems.length >= probeLimit,
    }
  }

  const acceptedIds = new Set(acceptedItems.map(getId))
  const count = incomingItems.filter((item) => !acceptedIds.has(getId(item))).length
  const hasAcceptedItem = incomingItems.some((item) => acceptedIds.has(getId(item)))
  if (hasAcceptedItem) return { count, truncated: false }

  return {
    count,
    truncated: incomingItems.length >= probeLimit,
  }
}
