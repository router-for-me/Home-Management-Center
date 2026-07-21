import { Navigate, Outlet, createRootRoute, createRoute } from '@tanstack/react-router'

import { UserAuthPage } from '@/features/access/user-auth-page'
import {
  UserForgotPasswordPage,
  UserResetPasswordPage,
  UserVerifyEmailPage,
} from '@/features/access/user-recovery-pages'
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

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/user/forgot-password',
  component: UserForgotPasswordPage,
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/user/reset-password',
  component: UserResetPasswordPage,
})

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/user/verify-email',
  component: UserVerifyEmailPage,
})

export const userRouteTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  verifyEmailRoute,
  workspaceRoute,
])
