import { createFileRoute } from '@tanstack/react-router'

import { AccessKeysWorkbenchPage } from '@/features/access-keys/access-keys-workbench-page'

export const Route = createFileRoute('/access-keys')({
  component: AccessKeysPage,
})

function AccessKeysPage() {
  return <AccessKeysWorkbenchPage />
}
