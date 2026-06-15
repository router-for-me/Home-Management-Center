import { useEffect } from 'react'

import { useNavigate } from '@tanstack/react-router'

import { Command } from 'cmdk'
import { CheckCircle2, LogOut, PlugZap } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useTranslation } from 'react-i18next'

import { navigationGroups } from '@/components/shell/navigation'
import { disconnectManagementSession } from '@/features/session/connect-session'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session-store'
import { useConsoleUiStore } from '@/stores/ui-store'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function useCommandPaletteShortcut() {
  const toggleCommandPalette = useConsoleUiStore((state) => state.toggleCommandPalette)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey)) return

      event.preventDefault()
      toggleCommandPalette()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleCommandPalette])
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const connectionStatus = useSessionStore((state) => state.status)
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)
  const connected = connectionStatus === 'connected'

  useCommandPaletteShortcut()

  const close = () => onOpenChange(false)

  const runCommand = (command: () => void) => {
    command()
    close()
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      loop
      label={t('commandPalette.label')}
      overlayClassName="bg-overlay fixed inset-0 z-[var(--z-overlay)] backdrop-blur-sm"
      contentClassName="bg-popover text-popover-foreground fixed top-[15vh] left-1/2 z-[var(--z-overlay)] grid w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-lg border p-0 shadow-2xl"
    >
      <DialogPrimitive.Title className="sr-only">{t('commandPalette.label')}</DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">
        {t('commandPalette.description')}
      </DialogPrimitive.Description>
      <div className="flex items-center gap-3 border-b px-4">
        <Command.Input
          className="placeholder:text-muted-foreground h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder={t('commandPalette.placeholder')}
        />
        <kbd className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">
          Esc
        </kbd>
      </div>

      <Command.List className="max-h-[420px] overflow-y-auto p-2">
        <Command.Empty className="text-muted-foreground px-3 py-8 text-center text-sm">
          {t('commandPalette.empty')}
        </Command.Empty>

        {navigationGroups.map((group) => (
          <Command.Group
            key={group.id}
            heading={t(group.labelKey)}
            className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium"
          >
            {group.items.map((item) => {
              const Icon = item.icon

              return (
                <Command.Item
                  key={item.to}
                  value={`${t(item.labelKey)} ${t(item.metaKey)}`}
                  keywords={[item.to, t(group.labelKey)]}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none',
                    'aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                  )}
                  onSelect={() =>
                    runCommand(() => {
                      void navigate({ to: item.to })
                    })
                  }
                >
                  <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t(item.labelKey)}</span>
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {t(item.metaKey)}
                    </span>
                  </span>
                </Command.Item>
              )
            })}
          </Command.Group>
        ))}

        <Command.Group
          heading={t('commandPalette.groups.session')}
          className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium"
        >
          <Command.Item
            value={t('commandPalette.commands.manageConnection.title')}
            keywords={[
              t('commandPalette.commands.manageConnection.keywords'),
              t('actions.manageConnection'),
            ]}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none',
              'aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
            )}
            onSelect={() =>
              runCommand(() => {
                openConnectionDialog()
              })
            }
          >
            {connected ? (
              <CheckCircle2 className="text-primary size-4 shrink-0" aria-hidden="true" />
            ) : (
              <PlugZap className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {t('commandPalette.commands.manageConnection.title')}
              </span>
              <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                {connected
                  ? t('commandPalette.commands.manageConnection.connected')
                  : t('commandPalette.commands.manageConnection.disconnected')}
              </span>
            </span>
          </Command.Item>

          {connected ? (
            <Command.Item
              value={t('commandPalette.commands.disconnect.title')}
              keywords={[t('commandPalette.commands.disconnect.keywords')]}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none',
                'aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
              )}
              onSelect={() =>
                runCommand(() => {
                  disconnectManagementSession()
                })
              }
            >
              <LogOut className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {t('commandPalette.commands.disconnect.title')}
                </span>
                <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                  {t('commandPalette.commands.disconnect.description')}
                </span>
              </span>
            </Command.Item>
          ) : null}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
