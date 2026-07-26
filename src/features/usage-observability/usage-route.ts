export type UsageWorkspaceView = 'overview' | 'requests'

type UsageRouteSearch = {
  view: UsageWorkspaceView
}

export function normalizeUsageRouteSearch(search: Record<string, unknown>): UsageRouteSearch {
  const rawView = typeof search.view === 'string' ? search.view.trim().toLowerCase() : ''
  return { view: rawView === 'requests' ? 'requests' : 'overview' }
}
