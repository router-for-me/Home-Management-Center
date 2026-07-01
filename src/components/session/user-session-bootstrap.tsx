import { useEffect, useRef } from 'react'

const managementOnlyRoutes = new Set([
  '/admin/dashboard',
  '/admin/access-keys',
  '/admin/billing',
  '/admin/connect',
  '/admin/config',
  '/admin/credentials',
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

function isManagementOnlyRoute() {
  const pathname = getCurrentRoutePathname()
  if (!pathname) return false

  return managementOnlyRoutes.has(pathname)
}

export function UserSessionBootstrap() {
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (bootstrappedRef.current) return
    if (isManagementOnlyRoute()) return

    bootstrappedRef.current = true
  }, [])

  return null
}
