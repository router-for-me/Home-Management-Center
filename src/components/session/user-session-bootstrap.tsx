import { useEffect, useRef } from 'react'

const managementOnlyRoutes = new Set([
  '/dashboard',
  '/access-keys',
  '/admin/connect',
  '/config',
  '/credentials',
  '/providers',
  '/system-nodes',
  '/usage-logs',
  '/users',
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