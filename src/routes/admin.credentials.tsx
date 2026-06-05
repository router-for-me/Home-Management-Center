import { createFileRoute } from '@tanstack/react-router'

import { CredentialsWorkbenchPage } from '@/features/credentials/credentials-workbench-page'

export const Route = createFileRoute('/admin/credentials')({
  component: CredentialsPage,
})

function CredentialsPage() {
  return <CredentialsWorkbenchPage />
}
