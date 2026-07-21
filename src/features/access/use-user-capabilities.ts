import { useQuery } from '@tanstack/react-query'

import { fetchUserCapabilities } from '@/lib/api/user/capabilities'
import { useUserSessionStore } from '@/stores/user-session-store'

export function useUserCapabilities() {
  const baseUrl = useUserSessionStore((state) => state.baseUrl)

  return useQuery({
    queryKey: ['user-capabilities', baseUrl],
    queryFn: () => fetchUserCapabilities({ baseUrl }),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
