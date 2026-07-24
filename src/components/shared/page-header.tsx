import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  titleMeta?: ReactNode
  meta?: ReactNode
  tags?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}

function PageHeader({
  title,
  description,
  titleMeta,
  meta,
  tags,
  actions,
  icon,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('bg-card rounded-lg border p-5 shadow-sm', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className={cn('min-w-0', icon ? 'flex gap-4' : null)}>
          {icon ? <div className="shrink-0">{icon}</div> : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal">{title}</h1>
              {titleMeta}
            </div>
            {description ? (
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
                {description}
              </p>
            ) : null}
            {meta ? (
              <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {meta}
              </div>
            ) : null}
            {tags ? <div className="mt-3 flex flex-wrap gap-2">{tags}</div> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export { PageHeader }
