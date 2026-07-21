import { Navigate, createFileRoute } from '@tanstack/react-router'

import { normalizeCredentialRouteSearch } from '@/features/credentials/credential-route'

export const Route = createFileRoute('/admin/credentials')({
  component: CredentialsRedirect,
  validateSearch: normalizeCredentialRouteSearch,
})

function CredentialsRedirect() {
  const search = Route.useSearch()
  return (
    <Navigate
      to="/admin/upstream"
      search={{ tab: 'accounts', credential: search.credential, q: search.q }}
      replace
    />
  )
}
