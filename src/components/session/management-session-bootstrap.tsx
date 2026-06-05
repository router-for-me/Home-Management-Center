import { useEffect, useRef } from 'react'

import { bootstrapManagementSession } from '@/features/session/connect-session'

const managementOnlyRoutes = new Set([
  '/admin/dashboard',
  '/admin/access-keys',
  '/admin/connect',
  '/admin/config',
  '/admin/credentials',
  '/admin/providers',
  '/admin/system-nodes',
  '/admin/usage-logs',
  '/admin/users',
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
