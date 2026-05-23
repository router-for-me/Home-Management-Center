import { createFileRoute } from '@tanstack/react-router'

import { ProvidersWorkbenchPage } from '@/features/providers/providers-workbench-page'

export const Route = createFileRoute('/providers')({
  component: ProvidersPage,
})

function ProvidersPage() {
  return <ProvidersWorkbenchPage />
}
