import { useEffect, useRef } from 'react'

import { bootstrapManagementSession } from '@/features/session/connect-session'

export function SessionBootstrap() {
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true

    void bootstrapManagementSession()
  }, [])

  return null
}
