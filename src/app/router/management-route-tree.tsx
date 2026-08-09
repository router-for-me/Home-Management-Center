import { Suspense } from 'react'

import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  lazyRouteComponent,
} from '@tanstack/react-router'

import { RoutePending } from '@/components/shell/route-pending'
import { RouteShell } from '@/components/shell/route-shell'
import { normalizeCredentialRouteSearch } from '@/features/credentials/credential-route'
import { normalizeUpstreamRouteSearch } from '@/features/upstream/upstream-route'
import { normalizeUsageRouteSearch } from '@/features/usage-observability/usage-route'

// Every workbench is its own chunk. Loaded statically they all landed in the
// management entry, so opening the dashboard also downloaded billing, config
// and the plugin store. Search normalizers stay static: validateSearch runs
// while the route tree is built, before any chunk could be fetched.
const AccessKeysWorkbenchPage = lazyRouteComponent(
  () => import('@/features/access-keys/access-keys-workbench-page'),
  'AccessKeysWorkbenchPage',
)
const AdminConnectPage = lazyRouteComponent(
  () => import('@/features/access/admin-connect-page'),
  'AdminConnectPage',
)
const BillingWorkbenchPage = lazyRouteComponent(
  () => import('@/features/billing/billing-workbench-page'),
  'BillingWorkbenchPage',
)
const CallDiagnosticsPage = lazyRouteComponent(
  () => import('@/features/call-diagnostics/call-diagnostics-page'),
  'CallDiagnosticsPage',
)
const ConfigWorkbenchPage = lazyRouteComponent(
  () => import('@/features/config/config-workbench-page'),
  'ConfigWorkbenchPage',
)
const DashboardConsolePage = lazyRouteComponent(
  () => import('@/features/dashboard/dashboard-console-page'),
  'DashboardConsolePage',
)
const LogsWorkbenchPage = lazyRouteComponent(
  () => import('@/features/logs/logs-workbench-page'),
  'LogsWorkbenchPage',
)
const PluginsWorkbenchPage = lazyRouteComponent(
  () => import('@/features/plugins/plugins-workbench-page'),
  'PluginsWorkbenchPage',
)
const SystemNodesWorkbenchPage = lazyRouteComponent(
  () => import('@/features/system-nodes/system-nodes-workbench-page'),
  'SystemNodesWorkbenchPage',
)
const UsersWorkbenchPage = lazyRouteComponent(
  () => import('@/features/users/users-workbench-page'),
  'UsersWorkbenchPage',
)

// These two routes read their own search params, so the route component stays
// local and the page underneath is what gets split. Their loaders warm the
// chunk so defaultPreload: 'intent' still prefetches on hover.
const UpstreamWorkbenchPage = lazyRouteComponent(
  () => import('@/features/upstream/upstream-workbench-page'),
  'UpstreamWorkbenchPage',
)
const UsageObservabilityPage = lazyRouteComponent(
  () => import('@/features/usage-observability/usage-observability-page'),
  'UsageObservabilityPage',
)

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
  loader: () => import('@/features/upstream/upstream-workbench-page'),
  component: ManagementUpstreamPage,
})

function ManagementUpstreamPage() {
  const search = upstreamRoute.useSearch()
  const navigate = upstreamRoute.useNavigate()
  return (
    <Suspense fallback={<RoutePending />}>
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
            search: (previous) => ({
              ...previous,
              credential: undefined,
              q: q.trim() || undefined,
            }),
            replace: true,
          })
        }
      />
    </Suspense>
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
  validateSearch: normalizeUsageRouteSearch,
  loader: () => import('@/features/usage-observability/usage-observability-page'),
  component: ManagementUsagePage,
})

function ManagementUsagePage() {
  const search = usageRoute.useSearch()
  const navigate = usageRoute.useNavigate()

  return (
    <Suspense fallback={<RoutePending />}>
      <UsageObservabilityPage
        view={search.view}
        onViewChange={(view) =>
          void navigate({
            search: (previous) => ({ ...previous, view }),
            replace: true,
          })
        }
      />
    </Suspense>
  )
}

const requestEventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/request-events',
  component: () => <Navigate to="/admin/usage" search={{ view: 'requests' }} replace />,
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
