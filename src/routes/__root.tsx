import { Outlet, createRootRoute } from '@tanstack/react-router'

import { AppShell } from '@/components/shell/app-shell'

export const Route = createRootRoute({
  component: RootRoute,
})

function RootRoute() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
