import { type CSSProperties, type KeyboardEvent, useId, useRef, useState } from 'react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { UsageActivityStatus } from '@/lib/api/management/usage-logs'
import { cn } from '@/lib/utils'

export type UsageActivityMatrixBucket = {
  id: string
  label: string
  requestCount: number
  successRate: number
  status: UsageActivityStatus
}

type UsageActivityMatrixProps = {
  ariaLabel: string
  buckets: UsageActivityMatrixBucket[]
  getBucketLabel: (bucket: UsageActivityMatrixBucket) => string
  getStatusClassName: (status: UsageActivityStatus) => string
  getStatusLabel: (status: UsageActivityStatus) => string
  className?: string
}

export function UsageActivityMatrix({
  ariaLabel,
  buckets,
  getBucketLabel,
  getStatusClassName,
  getStatusLabel,
  className,
}: UsageActivityMatrixProps) {
  const detailId = useId()
  const bucketRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, buckets.length - 1))
  const activeIndex = Math.min(selectedIndex, Math.max(0, buckets.length - 1))
  const activeBucket = buckets[activeIndex]
  const sparse = buckets.length <= 10
  const columnCount = Math.max(1, Math.min(buckets.length, 24))

  const focusBucket = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, buckets.length - 1))
    setSelectedIndex(nextIndex)
    bucketRefs.current[nextIndex]?.focus()
  }

  const handleBucketKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowLeft') nextIndex = index - 1
    if (event.key === 'ArrowRight') nextIndex = index + 1
    if (event.key === 'ArrowUp') nextIndex = index - columnCount
    if (event.key === 'ArrowDown') nextIndex = index + columnCount
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = buckets.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    focusBucket(nextIndex)
  }

  if (!activeBucket) return null

  const activeDetail = `${getStatusLabel(activeBucket.status)} · ${getBucketLabel(activeBucket)}`

  return (
    <div className={cn('min-w-0', className)}>
      <TooltipProvider delayDuration={150}>
        <div
          role="grid"
          aria-label={ariaLabel}
          aria-colcount={columnCount}
          aria-rowcount={Math.ceil(buckets.length / columnCount)}
          className={cn('grid w-max max-w-full', sparse ? 'gap-2' : 'gap-0.5 sm:gap-1')}
          style={
            {
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, max-content))`,
            } satisfies CSSProperties
          }
        >
          {buckets.map((bucket, index) => {
            const bucketLabel = getBucketLabel(bucket)
            const accessibleLabel = `${getStatusLabel(bucket.status)} · ${bucketLabel}`

            return (
              <Tooltip key={bucket.id}>
                <TooltipTrigger asChild>
                  <button
                    ref={(node) => {
                      bucketRefs.current[index] = node
                    }}
                    type="button"
                    role="gridcell"
                    tabIndex={index === activeIndex ? 0 : -1}
                    aria-label={accessibleLabel}
                    aria-describedby={index === activeIndex ? detailId : undefined}
                    className={cn(
                      "group/cell focus-visible:ring-ring/60 relative size-2.5 touch-manipulation rounded-[2px] transition-transform duration-150 outline-none before:absolute before:content-[''] hover:scale-110 focus-visible:scale-110 focus-visible:ring-[3px] motion-reduce:transition-none sm:size-3",
                      sparse ? 'before:-inset-1' : 'before:-inset-px',
                    )}
                    onFocus={() => setSelectedIndex(index)}
                    onPointerEnter={() => setSelectedIndex(index)}
                    onPointerDown={() => setSelectedIndex(index)}
                    onKeyDown={(event) => handleBucketKeyDown(event, index)}
                  >
                    <span
                      className={cn(
                        'pointer-events-none absolute inset-0 rounded-[2px]',
                        getStatusClassName(bucket.status),
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-72 text-left leading-5">
                  {accessibleLabel}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
      <p id={detailId} className="text-muted-foreground mt-2 min-h-5 text-xs leading-5">
        {activeDetail}
      </p>
    </div>
  )
}
