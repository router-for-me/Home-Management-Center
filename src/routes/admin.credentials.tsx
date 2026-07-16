import { createFileRoute } from '@tanstack/react-router'

import { normalizeCredentialRouteSearch } from '@/features/credentials/credential-route'
import { CredentialsWorkbenchPage } from '@/features/credentials/credentials-workbench-page'

export const Route = createFileRoute('/admin/credentials')({
  component: CredentialsPage,
  validateSearch: normalizeCredentialRouteSearch,
})

function CredentialsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CredentialsWorkbenchPage
      initialCredentialId={search.credential}
      initialSearch={search.q}
      onSearchChange={(q) =>
        void navigate({
          search: { credential: undefined, q: q.trim() || undefined },
          replace: true,
        })
      }
    />
  )
}
