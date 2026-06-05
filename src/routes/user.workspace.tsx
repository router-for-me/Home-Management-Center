import { createFileRoute } from '@tanstack/react-router'

import { UserWorkspacePage } from '@/features/access/user-workspace-page'

export const Route = createFileRoute('/user/workspace')({
  component: UserWorkspacePage,
})
