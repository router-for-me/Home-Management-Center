import { createFileRoute } from '@tanstack/react-router'

import { UsageObservabilityPage } from '@/features/usage-observability/usage-observability-page'
import { normalizeUsageRouteSearch } from '@/features/usage-observability/usage-route'

export const Route = createFileRoute('/admin/usage')({
  component: UsagePage,
  validateSearch: normalizeUsageRouteSearch,
})

function UsagePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <UsageObservabilityPage
      view={search.view}
      onViewChange={(view) =>
        void navigate({
          search: (previous) => ({ ...previous, view }),
          replace: true,
        })
      }
    />
  )
}
