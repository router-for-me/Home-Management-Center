import { Navigate, Outlet, createRootRoute, createRoute } from '@tanstack/react-router'

import { UserAuthPage } from '@/features/access/user-auth-page'
import { UserWorkspacePage } from '@/features/access/user-workspace-page'

const rootRoute = createRootRoute({
  component: UserRootRoute,
})

function UserRootRoute() {
  return <Outlet />
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/user/login" replace />,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/user/login',
  component: () => <UserAuthPage mode="login" />,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/user/register',
  component: () => <UserAuthPage mode="register" />,
})

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/user/workspace',
  component: UserWorkspacePage,
})

export const userRouteTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  workspaceRoute,
])
