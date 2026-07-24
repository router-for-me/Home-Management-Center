import { Navigate, Outlet, createRootRoute, createRoute } from '@tanstack/react-router'

import { RouteShell } from '@/components/shell/route-shell'
import { AccessKeysWorkbenchPage } from '@/features/access-keys/access-keys-workbench-page'
import { AdminConnectPage } from '@/features/access/admin-connect-page'
import { BillingWorkbenchPage } from '@/features/billing/billing-workbench-page'
import { CallDiagnosticsPage } from '@/features/call-diagnostics/call-diagnostics-page'
import { ConfigWorkbenchPage } from '@/features/config/config-workbench-page'
import { normalizeCredentialRouteSearch } from '@/features/credentials/credential-route'
import { DashboardConsolePage } from '@/features/dashboard/dashboard-console-page'
import { LogsWorkbenchPage } from '@/features/logs/logs-workbench-page'
import { PluginsWorkbenchPage } from '@/features/plugins/plugins-workbench-page'
import { RequestEventsPage } from '@/features/request-events/request-events-page'
import { SystemNodesWorkbenchPage } from '@/features/system-nodes/system-nodes-workbench-page'
import { normalizeUpstreamRouteSearch } from '@/features/upstream/upstream-route'
import { UpstreamWorkbenchPage } from '@/features/upstream/upstream-workbench-page'
import { UsageObservabilityPage } from '@/features/usage-observability/usage-observability-page'
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

const upstreamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/upstream',
  validateSearch: normalizeUpstreamRouteSearch,
  component: ManagementUpstreamPage,
})

function ManagementUpstreamPage() {
  const search = upstreamRoute.useSearch()
  const navigate = upstreamRoute.useNavigate()
  return (
    <UpstreamWorkbenchPage
      tab={search.tab}
      initialCredentialId={search.credential}
      initialSearch={search.q}
      onTabChange={(tab) =>
        void navigate({
          search: (previous) => ({ ...previous, tab }),
          replace: true,
        })
      }
      onSearchChange={(q) =>
        void navigate({
          search: (previous) => ({ ...previous, credential: undefined, q: q.trim() || undefined }),
          replace: true,
        })
      }
    />
  )
}

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/providers',
  component: () => <Navigate to="/admin/upstream" search={{ tab: 'providers' }} replace />,
})

const credentialsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/credentials',
  validateSearch: normalizeCredentialRouteSearch,
  component: ManagementCredentialsRedirect,
})

function ManagementCredentialsRedirect() {
  const search = credentialsRoute.useSearch()
  return (
    <Navigate
      to="/admin/upstream"
      search={{ tab: 'accounts', credential: search.credential, q: search.q }}
      replace
    />
  )
}

const quotaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/quota',
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q.trim() : undefined,
  }),
  component: ManagementQuotaRedirect,
})

function ManagementQuotaRedirect() {
  const search = quotaRoute.useSearch()
  return <Navigate to="/admin/upstream" search={{ tab: 'accounts', q: search.q }} replace />
}

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

const pluginsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/plugins',
  component: PluginsWorkbenchPage,
})

const usageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/usage',
  component: UsageObservabilityPage,
})

const requestEventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/request-events',
  component: RequestEventsPage,
})

const diagnosticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/diagnostics',
  component: CallDiagnosticsPage,
})

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/logs',
  component: LogsWorkbenchPage,
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
  upstreamRoute,
  providersRoute,
  credentialsRoute,
  quotaRoute,
  accessKeysRoute,
  usersRoute,
  billingRoute,
  configRoute,
  pluginsRoute,
  usageRoute,
  requestEventsRoute,
  diagnosticsRoute,
  logsRoute,
  systemNodesRoute,
])
