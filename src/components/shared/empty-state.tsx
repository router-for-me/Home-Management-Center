import type { ReactNode } from 'react'

import {
  AlertTriangle,
  CircleOff,
  Inbox,
  Info,
  type LucideIcon,
  SearchX,
  Settings2,
} from 'lucide-react'

import { cn } from '@/lib/utils'

export type EmptyStateKind = 'empty' | 'filtered-empty' | 'unsupported' | 'disabled' | 'error'

type EmptyStateProps = {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  kind?: EmptyStateKind
  compact?: boolean
  className?: string
  icon?: LucideIcon
}

const emptyStateIcons: Record<EmptyStateKind, LucideIcon> = {
  empty: Inbox,
  'filtered-empty': SearchX,
  unsupported: Info,
  disabled: CircleOff,
  error: AlertTriangle,
}

function getEmptyStateToneClassName(kind: EmptyStateKind) {
  if (kind === 'unsupported') return 'border-info/25 bg-info/10 text-info'
  if (kind === 'disabled') return 'border-warning/30 bg-warning/10 text-warning-foreground'
  if (kind === 'error') return 'border-destructive/30 bg-destructive/10 text-destructive'
  return 'border-border bg-muted/40 text-muted-foreground'
}

export function EmptyState({
  action,
  className,
  compact = false,
  description,
  icon,
  kind = 'empty',
  title,
}: EmptyStateProps) {
  const Icon = icon ?? emptyStateIcons[kind] ?? Settings2

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center justify-center text-center',
        compact ? 'px-4 py-6' : 'px-6 py-10',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-md border',
          getEmptyStateToneClassName(kind),
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-1 max-w-md text-sm leading-6">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}

export function TableEmptyState({ className, compact = true, ...props }: EmptyStateProps) {
  return (
    <EmptyState
      compact={compact}
      className={cn('bg-muted/10 m-3 min-h-36 rounded-md border border-dashed', className)}
      {...props}
    />
  )
}
