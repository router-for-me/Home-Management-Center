import { type CSSProperties, type KeyboardEvent, useId, useRef, useState } from 'react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsCompactViewport } from '@/hooks/use-compact-viewport'
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
  /*
   * These cells are real buttons, and at 24 columns they were 10px wide with a 12px
   * tap target — 28px under the floor every other control in the app clears. No
   * amount of invisible padding fixes that: 24 targets at 40px need 960px, and a
   * phone has 343. Expanding the hit areas into each other would only mean tapping
   * one cell and selecting its neighbour.
   *
   * So the grid changes shape instead of the cells changing padding: fewer columns
   * below 40rem wraps the same buckets into more rows and lets each one grow.
   *
   * Six, measured rather than guessed. The grid sits inside a card inside the page
   * padding, so it gets 309px of a 375px screen; eight columns landed at 36.9px and
   * could not have reached 40 even with the gap removed, because 309/8 is 38.6. Six
   * gives ~49px, and divides 24 buckets into four whole rows. The keyboard model
   * follows automatically — arrow-key navigation is derived from this number.
   */
  const isCompact = useIsCompactViewport()
  const columnCount = Math.max(1, Math.min(buckets.length, isCompact ? 6 : 24))

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
          className={cn(
            'grid',
            // Compact fills the row so the cells can grow; wide keeps the dense
            // heat-map look, sized to its content.
            isCompact ? 'w-full' : 'w-max max-w-full',
            sparse ? 'gap-2' : 'gap-0.5 sm:gap-1',
          )}
          style={
            {
              gridTemplateColumns: `repeat(${columnCount}, ${
                isCompact ? 'minmax(0, 1fr)' : 'minmax(0, max-content)'
              })`,
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
                      "group/cell focus-visible:ring-ring/60 relative touch-manipulation rounded-[2px] transition-transform duration-150 outline-none before:absolute before:content-[''] hover:scale-110 focus-visible:scale-110 focus-visible:ring-[3px] motion-reduce:transition-none",
                      // Compact: square cells that fill their track, so the target is
                      // as wide as the column. Wide: the dense fixed heat-map cell.
                      isCompact ? 'aspect-square w-full rounded-sm' : 'size-2.5 sm:size-3',
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
