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
              <h1 className="text-page-title tracking-normal">{title}</h1>
              {titleMeta}
            </div>
            {description ? (
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
                {description}
              </p>
            ) : null}
            {meta ? (
              <div className="text-muted-foreground text-meta mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {meta}
              </div>
            ) : null}
            {tags ? <div className="mt-3 flex flex-wrap gap-2">{tags}</div> : null}
          </div>
        </div>
        {actions ? (
          /*
           * Below 40rem the actions stack and stretch instead of wrapping. Wrapping
           * put three Russian labels on three rows at 182 / 163 / 215px — ragged
           * left-aligned buttons with uneven dead space beside each. A column of
           * equal full-width buttons is the same height and reads as one group,
           * which is what the sheet footer already does with its own button pair.
           */
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export { PageHeader }
