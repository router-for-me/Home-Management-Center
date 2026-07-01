import { createFileRoute } from '@tanstack/react-router'

import { PluginsWorkbenchPage } from '@/features/plugins/plugins-workbench-page'

export const Route = createFileRoute('/admin/plugins')({
  component: PluginsPage,
})

function PluginsPage() {
  return <PluginsWorkbenchPage />
}
