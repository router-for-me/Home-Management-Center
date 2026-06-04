import type { ReactNode } from 'react'

import { Toaster } from 'sonner'

import { ManagementSessionBootstrap } from '@/components/session/management-session-bootstrap'
import { UserSessionBootstrap } from '@/components/session/user-session-bootstrap'
import { ThemeProvider } from '@/components/theme-provider'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ManagementSessionBootstrap />
      <UserSessionBootstrap />
      {children}
      <Toaster richColors closeButton position="top-right" visibleToasts={1} gap={12} />
    </ThemeProvider>
  )
}
