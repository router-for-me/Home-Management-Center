import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/request-events')({
  component: RequestEventsRoute,
})

function RequestEventsRoute() {
  return <Navigate to="/admin/usage" search={{ view: 'requests' }} replace />
}
