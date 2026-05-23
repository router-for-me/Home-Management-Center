import { createFileRoute } from '@tanstack/react-router'

import { SystemNodesWorkbenchPage } from '@/features/system-nodes/system-nodes-workbench-page'

export const Route = createFileRoute('/system-nodes')({
  component: SystemNodesPage,
})

function SystemNodesPage() {
  return <SystemNodesWorkbenchPage />
}
