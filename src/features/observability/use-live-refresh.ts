import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import type { LiveRefreshPauseReason } from '@/features/observability/live-refresh'

function subscribeToBrowserActivity(onStoreChange: () => void) {
  document.addEventListener('visibilitychange', onStoreChange)
  window.addEventListener('online', onStoreChange)
  window.addEventListener('offline', onStoreChange)

  return () => {
    document.removeEventListener('visibilitychange', onStoreChange)
    window.removeEventListener('online', onStoreChange)
    window.removeEventListener('offline', onStoreChange)
  }
}

function getBrowserActivitySnapshot() {
  return `${document.visibilityState}:${navigator.onLine ? 'online' : 'offline'}`
}

function getServerBrowserActivitySnapshot() {
  return 'visible:online'
}

function readStoredPreference(storageKey: string, defaultEnabled: boolean) {
  if (typeof window === 'undefined') return defaultEnabled
  try {
    const storedValue = window.localStorage.getItem(storageKey)
    return storedValue === null ? defaultEnabled : storedValue === 'true'
  } catch {
    return defaultEnabled
  }
}

export function useBrowserActivity() {
  const snapshot = useSyncExternalStore(
    subscribeToBrowserActivity,
    getBrowserActivitySnapshot,
    getServerBrowserActivitySnapshot,
  )

  return useMemo(
    () => ({
      visible: snapshot.startsWith('visible:'),
      online: snapshot.endsWith(':online'),
    }),
    [snapshot],
  )
}

export function useLiveRefresh({
  storageKey,
  defaultEnabled,
  eligible,
  detailOpen = false,
  ineligibleReason = 'ineligible',
}: {
  storageKey: string
  defaultEnabled: boolean
  eligible: boolean
  detailOpen?: boolean
  ineligibleReason?: Exclude<LiveRefreshPauseReason, 'disabled' | 'hidden' | 'offline' | 'detail'>
}) {
  const activity = useBrowserActivity()
  const [enabled, setEnabledState] = useState(() =>
    readStoredPreference(storageKey, defaultEnabled),
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(enabled))
    } catch {
      // Embedded runtimes may disable storage; the in-memory preference still works.
    }
  }, [enabled, storageKey])

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled)
  }, [])

  const available = eligible || ineligibleReason !== 'unavailable'
  let pauseReason: LiveRefreshPauseReason | null = null
  if (!available) pauseReason = 'unavailable'
  else if (!enabled) pauseReason = 'disabled'
  else if (!eligible) pauseReason = ineligibleReason
  else if (detailOpen) pauseReason = 'detail'
  else if (!activity.visible) pauseReason = 'hidden'
  else if (!activity.online) pauseReason = 'offline'

  return {
    enabled,
    setEnabled,
    active: pauseReason === null,
    pauseReason,
    available,
    visible: activity.visible,
    online: activity.online,
  }
}
