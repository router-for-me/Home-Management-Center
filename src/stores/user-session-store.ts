import { create } from 'zustand'

import { getUserAccessAvailability } from '@/lib/api/user/access'

type UserSessionStatus = 'unavailable' | 'disconnected' | 'checking' | 'authenticated' | 'error'

type UserSessionState = {
  status: UserSessionStatus
  username: string | null
  errorMessage: string | null
  reset: () => void
}

const availability = getUserAccessAvailability()

export const useUserSessionStore = create<UserSessionState>((set) => ({
  status: availability.status === 'unsupported' ? 'unavailable' : 'disconnected',
  username: null,
  errorMessage: null,
  reset: () =>
    set({
      status: availability.status === 'unsupported' ? 'unavailable' : 'disconnected',
      username: null,
      errorMessage: null,
    }),
}))
