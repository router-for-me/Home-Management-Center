import { createFileRoute } from '@tanstack/react-router'

import { UsersWorkbenchPage } from '@/features/users/users-workbench-page'

export const Route = createFileRoute('/users')({
  component: UsersPage,
})

function UsersPage() {
  return <UsersWorkbenchPage />
}
