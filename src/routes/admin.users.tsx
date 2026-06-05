import { createFileRoute } from '@tanstack/react-router'

import { UsersWorkbenchPage } from '@/features/users/users-workbench-page'

export const Route = createFileRoute('/admin/users')({
  component: UsersPage,
})

function UsersPage() {
  return <UsersWorkbenchPage />
}
