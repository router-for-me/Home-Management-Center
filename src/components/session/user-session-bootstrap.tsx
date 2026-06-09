import { useEffect, useRef } from 'react'

const managementOnlyRoutes = new Set([
  '/admin/dashboard',
  '/admin/access-keys',
  '/admin/billing',
  '/admin/connect',
  '/admin/config',
  '/admin/credentials',
  '/admin/providers',
  '/admin/system-nodes',
  '/admin/usage-logs',
  '/admin/users',
])

function isManagementOnlyRoute() {
  if (typeof window === 'undefined') return false
  return managementOnlyRoutes.has(window.location.pathname)
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
