import { normalizeCredentialRouteSearch } from '@/features/credentials/credential-route'

export type UpstreamTab = 'accounts' | 'providers'

type UpstreamRouteSearch = {
  tab: UpstreamTab
  credential?: string
  q?: string
}

export function normalizeUpstreamRouteSearch(search: Record<string, unknown>): UpstreamRouteSearch {
  const credentialSearch = normalizeCredentialRouteSearch(search)
  const rawTab = typeof search.tab === 'string' ? search.tab.trim().toLowerCase() : ''
  const tab: UpstreamTab = rawTab === 'providers' ? 'providers' : 'accounts'

  return {
    // A credential deep link only makes sense on the accounts tab.
    tab: credentialSearch.credential ? 'accounts' : tab,
    credential: credentialSearch.credential,
    q: credentialSearch.q,
  }
}
