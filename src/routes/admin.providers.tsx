import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/providers')({
  component: ProvidersRedirect,
})

function ProvidersRedirect() {
  return <Navigate to="/admin/upstream" search={{ tab: 'providers' }} replace />
}
