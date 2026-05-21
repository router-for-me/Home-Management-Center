import { createFileRoute } from '@tanstack/react-router'

import { UsageLogsWorkbenchPage } from '@/features/usage-logs/usage-logs-workbench-page'

export const Route = createFileRoute('/usage-logs')({
  component: UsageLogsPage,
})

function UsageLogsPage() {
  return <UsageLogsWorkbenchPage />
}
