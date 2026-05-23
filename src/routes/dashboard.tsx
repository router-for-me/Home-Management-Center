import { createFileRoute } from '@tanstack/react-router'

import { DashboardConsolePage } from '@/features/dashboard/dashboard-console-page'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return <DashboardConsolePage />
}
