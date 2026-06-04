import { useEffect, useRef } from 'react'

import { bootstrapManagementSession } from '@/features/session/connect-session'

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

function isManagementRoute() {
  if (typeof window === 'undefined') return false
  const pathname = window.location.pathname
  return managementOnlyRoutes.has(pathname) || pathname === '/'
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
