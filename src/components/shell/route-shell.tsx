import type { ReactNode } from 'react'

import { useRouterState } from '@tanstack/react-router'

import { AppShell } from '@/components/shell/app-shell'

type RouteShellProps = {
  children: ReactNode
}

const publicRoutes = new Set(['/', '/admin/connect', '/login', '/register', '/workspace'])

export function RouteShell({ children }: RouteShellProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (publicRoutes.has(pathname)) {
    return children
  }

  return <AppShell>{children}</AppShell>
}
