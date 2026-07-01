import { useEffect, useRef } from 'react'

import { bootstrapManagementSession } from '@/features/session/connect-session'

const managementOnlyRoutes = new Set([
  '/admin/dashboard',
  '/admin/access-keys',
  '/admin/billing',
  '/admin/connect',
  '/admin/config',
  '/admin/credentials',
  '/admin/diagnostics',
  '/admin/logs',
  '/admin/providers',
  '/admin/system-nodes',
  '/admin/usage',
  '/admin/users',
])

function getCurrentRoutePathname() {
  if (typeof window === 'undefined') return false
  const hashPath = window.location.hash.slice(1)

  if (hashPath.startsWith('/')) {
    return hashPath.split(/[?#]/)[0] || '/'
  }

  return window.location.pathname
}

function isManagementRoute() {
  const pathname = getCurrentRoutePathname()
  if (!pathname) return false

  return managementOnlyRoutes.has(pathname) || pathname === '/' || pathname.endsWith('/index.html')
}

export function ManagementSessionBootstrap() {
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (bootstrappedRef.current) return
    if (!isManagementRoute()) return

    bootstrappedRef.current = true
    void bootstrapManagementSession()
  }, [])

  return null
}
