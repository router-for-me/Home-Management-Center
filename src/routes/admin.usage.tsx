import { createFileRoute } from '@tanstack/react-router'

import { UsageObservabilityPage } from '@/features/usage-observability/usage-observability-page'

export const Route = createFileRoute('/admin/usage')({
  component: UsagePage,
})

function UsagePage() {
  return <UsageObservabilityPage />
}
