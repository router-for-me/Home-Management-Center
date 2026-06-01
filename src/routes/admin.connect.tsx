import { createFileRoute } from '@tanstack/react-router'

import { AdminConnectPage } from '@/features/access/admin-connect-page'

export const Route = createFileRoute('/admin/connect')({
  component: AdminConnectPage,
})
