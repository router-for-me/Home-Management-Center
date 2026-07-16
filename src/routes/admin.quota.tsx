import { createFileRoute } from '@tanstack/react-router'

import { normalizeQuotaRouteSearch } from '@/features/quota/quota-model'
import { QuotaWorkbenchPage } from '@/features/quota/quota-workbench-page'

export const Route = createFileRoute('/admin/quota')({
  component: QuotaPage,
  validateSearch: normalizeQuotaRouteSearch,
})

function QuotaPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <QuotaWorkbenchPage
      initialSearch={search.q}
      onSearchChange={(q) => void navigate({ search: { q: q.trim() || undefined }, replace: true })}
    />
  )
}
