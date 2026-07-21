import { createFileRoute } from '@tanstack/react-router'

import { normalizeUpstreamRouteSearch } from '@/features/upstream/upstream-route'
import { UpstreamWorkbenchPage } from '@/features/upstream/upstream-workbench-page'

export const Route = createFileRoute('/admin/upstream')({
  component: UpstreamPage,
  validateSearch: normalizeUpstreamRouteSearch,
})

function UpstreamPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <UpstreamWorkbenchPage
      tab={search.tab}
      initialCredentialId={search.credential}
      initialSearch={search.q}
      onTabChange={(tab) =>
        void navigate({
          search: (previous) => ({ ...previous, tab }),
          replace: true,
        })
      }
      onSearchChange={(q) =>
        void navigate({
          search: (previous) => ({ ...previous, credential: undefined, q: q.trim() || undefined }),
          replace: true,
        })
      }
    />
  )
}
