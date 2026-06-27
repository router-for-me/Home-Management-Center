import type { ReactNode } from 'react'

import { Toaster } from 'sonner'

import { ManagementSessionBootstrap } from '@/components/session/management-session-bootstrap'
import { UserSessionBootstrap } from '@/components/session/user-session-bootstrap'
import { ThemeProvider } from '@/components/theme-provider'

type AppProvidersProps = {
  children: ReactNode
}

function BaseAppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
      <Toaster richColors closeButton position="top-right" visibleToasts={1} gap={12} />
    </ThemeProvider>
  )
}

export function BridgeAppProviders({ children }: AppProvidersProps) {
  return (
    <BaseAppProviders>
      <ManagementSessionBootstrap />
      <UserSessionBootstrap />
      {children}
    </BaseAppProviders>
  )
}

export function ManagementAppProviders({ children }: AppProvidersProps) {
  return (
    <BaseAppProviders>
      <ManagementSessionBootstrap />
      {children}
    </BaseAppProviders>
  )
}

export function UserAppProviders({ children }: AppProvidersProps) {
  return (
    <BaseAppProviders>
      <UserSessionBootstrap />
      {children}
    </BaseAppProviders>
  )
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BaseAppProviders>
      <ManagementSessionBootstrap />
      <UserSessionBootstrap />
      {children}
    </BaseAppProviders>
  )
}
