import { Outlet, createRootRoute } from '@tanstack/react-router'

import { RouteShell } from '@/components/shell/route-shell'

export const Route = createRootRoute({
  component: RootRoute,
})

function RootRoute() {
  return (
    <RouteShell>
      <Outlet />
    </RouteShell>
  )
}
