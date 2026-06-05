import { createFileRoute } from '@tanstack/react-router'

import { ConfigWorkbenchPage } from '@/features/config/config-workbench-page'

export const Route = createFileRoute('/admin/config')({
  component: ConfigPage,
})

function ConfigPage() {
  return <ConfigWorkbenchPage />
}
