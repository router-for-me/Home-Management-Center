import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/quota')({
  component: QuotaRedirect,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q.trim() : undefined,
  }),
})

function QuotaRedirect() {
  const search = Route.useSearch()
  return <Navigate to="/admin/upstream" search={{ tab: 'accounts', q: search.q }} replace />
}
