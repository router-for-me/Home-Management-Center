import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const containedTableContainerClassName = 'max-h-[min(640px,calc(100vh-280px))] overflow-auto'
/*
 * One header background, because the sticky action column has to paint an opaque
 * copy of it and can only match one value. Headers written at 70% and 40% opacity
 * left that column visibly darker than the row of heads it sits in.
 */
const tableHeaderClassName = 'bg-muted text-muted-foreground'
const stickyTableHeaderClassName = `${tableHeaderClassName} sticky top-0 z-[var(--z-table-sticky)] shadow-[0_1px_0_var(--border)]`

function TableSurface({
  children,
  pagination,
  className,
}: {
  children: ReactNode
  pagination?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-card overflow-hidden rounded-lg border shadow-sm', className)}>
      {children}
      {pagination}
    </div>
  )
}

function TableSurfaceHeader({
  title,
  description,
  actions,
  className,
  actionsClassName,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  actionsClassName?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b p-4 md:flex-row md:items-start md:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm leading-6">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className={cn('flex shrink-0 flex-wrap gap-2', actionsClassName)}>{actions}</div>
      ) : null}
    </div>
  )
}

function TableSurfaceContent({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} data-slot="table-surface-content" className={cn('p-4', className)} />
}

function TablePaginationStatus({
  text,
  announcementKey,
  busy = false,
  className,
}: {
  text: string
  announcementKey: string | number
  busy?: boolean
  className?: string
}) {
  const previousKeyRef = useRef(announcementKey)
  const pendingAnnouncementRef = useRef(false)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (!Object.is(previousKeyRef.current, announcementKey)) {
      previousKeyRef.current = announcementKey
      pendingAnnouncementRef.current = true
    }
    if (busy || !pendingAnnouncementRef.current) return
    pendingAnnouncementRef.current = false
    setAnnouncement(text)
  }, [announcementKey, busy, text])

  return (
    <>
      <p className={cn('text-muted-foreground text-sm', className)}>{text}</p>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  )
}

export {
  TablePaginationStatus,
  TableSurface,
  TableSurfaceContent,
  TableSurfaceHeader,
  containedTableContainerClassName,
  stickyTableHeaderClassName,
  tableHeaderClassName,
}
