import { createFileRoute } from '@tanstack/react-router'

import { LogsWorkbenchPage } from '@/features/logs/logs-workbench-page'

export const Route = createFileRoute('/admin/logs')({
  component: LogsPage,
})

function LogsPage() {
  return <LogsWorkbenchPage />
}
