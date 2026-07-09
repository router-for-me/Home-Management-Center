import { createFileRoute } from '@tanstack/react-router'

import { RequestEventsPage } from '@/features/request-events/request-events-page'

export const Route = createFileRoute('/admin/request-events')({
  component: RequestEventsRoute,
})

function RequestEventsRoute() {
  return <RequestEventsPage />
}
