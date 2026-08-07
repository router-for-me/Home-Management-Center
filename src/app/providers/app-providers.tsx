import type { ReactNode } from 'react'

import { Toaster } from 'sonner'

import { ManagementSessionBootstrap } from '@/components/session/management-session-bootstrap'
import { UserSessionBootstrap } from '@/components/session/user-session-bootstrap'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'

type AppProvidersProps = {
  children: ReactNode
}

function BaseAppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/*
       * The only other TooltipProvider lives inside the sidebar, so every route
       * that renders without the app shell - the bridge, the user auth pages,
       * /admin/connect - crashed as soon as anything below it used a Tooltip.
       * Nesting is fine: the sidebar's provider still wins for its own subtree.
       */}
      <TooltipProvider>
        {children}
        <Toaster richColors closeButton position="top-right" visibleToasts={1} gap={12} />
      </TooltipProvider>
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
