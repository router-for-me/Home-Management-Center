import type { ReactNode } from 'react'

import { Link, useRouterState } from '@tanstack/react-router'

import { CheckCircle2, CircleAlert, Loader2, Search, Settings2, Unplug } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import productLogo from '@/assets/brand/logo.jpg'
import { ConnectionDialog } from '@/components/session/connection-dialog'
import { CommandPalette } from '@/components/shell/command-palette'
import { LanguageSwitcher } from '@/components/shell/language-switcher'
import { navigationGroups, navigationItems } from '@/components/shell/navigation'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'
import { useConsoleUiStore } from '@/stores/ui-store'

type AppShellProps = {
  children: ReactNode
}

function ConnectionStatusIndicator() {
  const { t } = useTranslation()
  const status = useSessionStore((state) => state.status)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)
  const { state, isMobile } = useSidebar()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)
  const collapsed = state === 'collapsed' && !isMobile
  const connected = status === 'connected'
  const checking = status === 'checking'
  const errored = status === 'error'
  const runtimeLabel = t(`runtimeMode.${runtimeMode}`)
  const statusText = connected
    ? t('sidebar.connectionStatus.connected')
    : checking
      ? t('sidebar.connectionStatus.checking')
      : errored
        ? t('sidebar.connectionStatus.error')
        : t('sidebar.connectionStatus.disconnected')
  const buttonLabel = connected
    ? t('sidebar.connectionStatus.connectedAction', { mode: runtimeLabel })
    : errored
      ? t('sidebar.connectionStatus.errorAction')
      : t('sidebar.connectionStatus.disconnectedAction')

  if (collapsed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={buttonLabel}
        className={cn(
          'mx-auto rounded-md border',
          connected
            ? 'border-sidebar-primary/40 bg-sidebar-primary/12 text-sidebar-primary hover:bg-sidebar-primary/18'
            : errored
              ? 'border-destructive/45 bg-destructive/12 text-destructive hover:bg-destructive/18'
              : 'border-sidebar-border bg-sidebar-accent/50 text-sidebar-icon hover:bg-sidebar-accent hover:text-sidebar-icon-hover',
        )}
        title={buttonLabel}
        onClick={openConnectionDialog}
      >
        {checking ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : connected ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : errored ? (
          <CircleAlert className="size-4" aria-hidden="true" />
        ) : (
          <Unplug className="size-4" aria-hidden="true" />
        )}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={buttonLabel}
      // a sidebar navigation row, not a toolbar control: it spans the rail and
      // keeps the 44px nav rhythm, which no control step describes.
      // eslint-disable-next-line home-ui/no-control-size-override
      className={cn(
        'group/status flex h-11 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border px-2.5 text-left',
        connected
          ? 'border-sidebar-primary/30 bg-sidebar-primary/10 hover:bg-sidebar-primary/14'
          : errored
            ? 'border-destructive/45 bg-destructive/10 hover:bg-destructive/14'
            : 'border-sidebar-border bg-sidebar-accent/45 hover:bg-sidebar-accent',
      )}
      onClick={openConnectionDialog}
    >
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded',
          connected ? 'text-sidebar-primary' : errored ? 'text-destructive' : 'text-sidebar-icon',
        )}
      >
        {checking ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : connected ? (
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
        ) : errored ? (
          <CircleAlert className="size-3.5" aria-hidden="true" />
        ) : (
          <Unplug className="size-3.5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{statusText}</span>
      <span className="text-sidebar-muted-foreground max-w-20 min-w-0 truncate text-[10.5px]">
        {runtimeLabel}
      </span>
      <Settings2
        className="text-sidebar-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover/status:opacity-100 group-focus-visible/status:opacity-100"
        aria-hidden="true"
      />
    </Button>
  )
}

function AppSidebarTrigger() {
  const { t } = useTranslation()
  const { state, isMobile } = useSidebar()
  const label = isMobile
    ? t('sidebar.openMobile')
    : state === 'collapsed'
      ? t('sidebar.expand')
      : t('sidebar.collapse')

  return (
    <SidebarTrigger
      aria-label={label}
      title={label}
      className="hover:bg-muted bg-card size-9 border"
    />
  )
}

function HeaderConnectionButton() {
  const { t } = useTranslation()
  const status = useSessionStore((state) => state.status)
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)
  const connected = status === 'connected'
  const checking = status === 'checking'
  const errored = status === 'error'

  return (
    <Button
      variant="outline"
      size="lg"
      className={cn(
        'hidden sm:inline-flex',
        connected
          ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
          : errored
            ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
            : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      onClick={openConnectionDialog}
    >
      {checking ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : connected ? (
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
      ) : errored ? (
        <CircleAlert className="size-3.5" aria-hidden="true" />
      ) : (
        <Unplug className="size-3.5" aria-hidden="true" />
      )}
      {t('actions.manageConnection')}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// App Shell Layout
// ---------------------------------------------------------------------------

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const connectionDialogOpen = useConsoleUiStore((state) => state.connectionDialogOpen)
  const setConnectionDialogOpen = useConsoleUiStore((state) => state.setConnectionDialogOpen)
  const commandPaletteOpen = useConsoleUiStore((state) => state.commandPaletteOpen)
  const setCommandPaletteOpen = useConsoleUiStore((state) => state.setCommandPaletteOpen)
  const openCommandPalette = useConsoleUiStore((state) => state.openCommandPalette)
  const currentItem =
    navigationItems.find((item) => pathname.startsWith(item.to)) ?? navigationItems[0]

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-sidebar-border text-sidebar-foreground">
        <SidebarHeader className="border-sidebar-border/80 border-b p-0">
          <div className="flex h-14 items-center gap-3 px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <div className="ring-sidebar-primary/25 bg-sidebar-accent flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md ring-1">
              <img src={productLogo} alt="" aria-hidden="true" className="size-full object-cover" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sidebar-foreground truncate text-sm font-semibold">
                {t('productShortName')}
              </p>
              <p className="text-sidebar-muted-foreground truncate text-xs">
                {t('sidebar.controlPlane')}
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-1 py-2">
          {navigationGroups.map((group, groupIndex) => (
            <SidebarGroup
              key={group.id}
              className={cn('px-2 py-1', groupIndex > 0 ? 'pt-2' : 'pt-0')}
            >
              <SidebarGroupLabel className="text-sidebar-muted-foreground h-6 px-2 text-[10px] font-semibold tracking-wider uppercase select-none group-data-[collapsible=icon]:hidden">
                {t(group.labelKey)}
              </SidebarGroupLabel>
              {groupIndex > 0 && (
                <div
                  className="bg-sidebar-border mx-auto my-1 hidden h-px w-6 rounded-full group-data-[collapsible=icon]:block"
                  aria-hidden="true"
                />
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname.startsWith(item.to)
                    const itemLabel = t(item.labelKey)

                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={itemLabel}
                          className={cn(
                            'group/nav-item relative flex h-11 items-center gap-3 rounded-md px-3.5 text-sm font-medium transition-colors duration-150',
                            isActive
                              ? '!bg-sidebar-active hover:!bg-sidebar-active-hover data-[active=true]:!bg-sidebar-active !text-sidebar-active-foreground hover:!text-sidebar-active-foreground data-[active=true]:!text-sidebar-active-foreground'
                              : 'hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground !text-sidebar-foreground data-[active=false]:!text-sidebar-foreground',
                            'group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-0',
                          )}
                        >
                          <Link to={item.to}>
                            {!isActive && (
                              <span
                                className="absolute top-2 bottom-2 left-0 w-0.5 rounded-r bg-transparent"
                                aria-hidden="true"
                              />
                            )}
                            {isActive && (
                              <span
                                className="bg-sidebar-primary absolute top-2 bottom-2 left-0 w-0.5 rounded-r"
                                aria-hidden="true"
                              />
                            )}

                            <Icon
                              className={cn(
                                'size-4 shrink-0',
                                isActive
                                  ? 'text-sidebar-primary'
                                  : 'text-sidebar-icon group-hover/nav-item:text-sidebar-icon-hover',
                              )}
                              aria-hidden="true"
                            />

                            <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
                              {itemLabel}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-sidebar-border/80 border-t p-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:px-0">
          <ConnectionStatusIndicator />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background min-w-0">
        <header className="bg-background/92 sticky top-0 z-[var(--z-shell-header)] flex h-16 shrink-0 items-center justify-between gap-3 overflow-hidden border-b px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <AppSidebarTrigger />
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold">{t(currentItem.labelKey)}</p>
              <span className="bg-border hidden h-4 w-px sm:block" aria-hidden="true" />
              <p className="text-muted-foreground hidden truncate text-xs sm:block">
                {t(currentItem.metaKey)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="bg-card text-muted-foreground hidden min-w-44 justify-between font-normal md:inline-flex"
              onClick={openCommandPalette}
            >
              <span className="flex items-center gap-2">
                <Search className="size-3.5" aria-hidden="true" />
                {t('commandPalette.trigger')}
              </span>
              <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                {t('commandPalette.shortcut')}
              </kbd>
            </Button>
            <ThemeSwitcher />
            <LanguageSwitcher />
            <HeaderConnectionButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-clip p-4 md:p-6">{children}</main>
      </SidebarInset>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <ConnectionDialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen} />
    </SidebarProvider>
  )
}
