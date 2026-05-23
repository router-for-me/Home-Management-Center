import type { ReactNode } from 'react'

import { Toaster } from 'sonner'

import { SessionBootstrap } from '@/components/session/session-bootstrap'
import { ThemeProvider } from '@/components/theme-provider'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionBootstrap />
      {children}
      <Toaster richColors closeButton position="top-right" visibleToasts={1} gap={12} />
    </ThemeProvider>
  )
}
