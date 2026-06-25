import { Navigate, Outlet, createRootRoute, createRoute } from '@tanstack/react-router'

import { RouteShell } from '@/components/shell/route-shell'
import { AccessKeysWorkbenchPage } from '@/features/access-keys/access-keys-workbench-page'
import { AdminConnectPage } from '@/features/access/admin-connect-page'
import { BillingWorkbenchPage } from '@/features/billing/billing-workbench-page'
import { ConfigWorkbenchPage } from '@/features/config/config-workbench-page'
import { CredentialsWorkbenchPage } from '@/features/credentials/credentials-workbench-page'
import { DashboardConsolePage } from '@/features/dashboard/dashboard-console-page'
import { ProvidersWorkbenchPage } from '@/features/providers/providers-workbench-page'
import { SystemNodesWorkbenchPage } from '@/features/system-nodes/system-nodes-workbench-page'
import { UsageLogsWorkbenchPage } from '@/features/usage-logs/usage-logs-workbench-page'
import { UsersWorkbenchPage } from '@/features/users/users-workbench-page'

const rootRoute = createRootRoute({
  component: ManagementRootRoute,
})

function ManagementRootRoute() {
  return (
    <RouteShell>
      <Outlet />
    </RouteShell>
  )
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/admin/dashboard" replace />,
})

const connectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/connect',
  component: AdminConnectPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/dashboard',
  component: DashboardConsolePage,
})

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/providers',
  component: ProvidersWorkbenchPage,
})

const credentialsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/credentials',
  component: CredentialsWorkbenchPage,
})

const accessKeysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/access-keys',
  component: AccessKeysWorkbenchPage,
})

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  component: UsersWorkbenchPage,
})

const billingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/billing',
  component: BillingWorkbenchPage,
})

const configRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/config',
  component: ConfigWorkbenchPage,
})

const usageLogsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/usage-logs',
  component: UsageLogsWorkbenchPage,
})

const systemNodesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/system-nodes',
  component: SystemNodesWorkbenchPage,
})

export const managementRouteTree = rootRoute.addChildren([
  indexRoute,
  connectRoute,
  dashboardRoute,
  providersRoute,
  credentialsRoute,
  accessKeysRoute,
  usersRoute,
  billingRoute,
  configRoute,
  usageLogsRoute,
  systemNodesRoute,
])
