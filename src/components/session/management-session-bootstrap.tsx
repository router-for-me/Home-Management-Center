import { useEffect, useRef } from 'react'

import { bootstrapManagementSession } from '@/features/session/connect-session'
import { fetchDeclaredUsageTokenBreakdownV2Capability } from '@/lib/api/management/probe'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

const dynamicCapabilityRefreshMs = 30_000

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
  '/admin/upstream',
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
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const connected = useSessionStore((state) => state.status === 'connected')
  const capabilityReady = useCapabilityStore((state) => state.status === 'ready')

  useEffect(() => {
    if (bootstrappedRef.current) return
    if (!isManagementRoute()) return

    bootstrappedRef.current = true
    void bootstrapManagementSession()
  }, [])

  useEffect(() => {
    if (!connected || !capabilityReady || !managementKey) return

    let disposed = false
    let refreshing = false
    const refresh = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const available = await fetchDeclaredUsageTokenBreakdownV2Capability({
          baseUrl,
          managementKey,
        })
        if (!disposed && available !== null) {
          useCapabilityStore.getState().setUsageTokenBreakdownV2(available)
        }
      } catch {
        // Keep the last declared value during transient capability refresh failures.
      } finally {
        refreshing = false
      }
    }

    const timer = window.setInterval(() => void refresh(), dynamicCapabilityRefreshMs)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [baseUrl, capabilityReady, connected, managementKey])

  return null
}
