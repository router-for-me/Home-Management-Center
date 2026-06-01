import { createFileRoute } from '@tanstack/react-router'

import { AccessEntryPage } from '@/features/access/access-entry-page'

export const Route = createFileRoute('/')({
  component: IndexRoute,
})

function IndexRoute() {
  return <AccessEntryPage />
}
