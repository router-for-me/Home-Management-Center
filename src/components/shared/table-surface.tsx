import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const containedTableContainerClassName = 'max-h-[min(640px,calc(100vh-280px))] overflow-auto'
const stickyTableHeaderClassName =
  'bg-muted text-muted-foreground sticky top-0 z-20 shadow-[0_1px_0_var(--border)]'

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

export { TableSurface, containedTableContainerClassName, stickyTableHeaderClassName }
