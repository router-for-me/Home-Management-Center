import { useCallback, useEffect, useRef, useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function OverflowTooltipText({
  value,
  className,
  tooltipClassName,
  overflowClassName,
}: {
  value: string
  className?: string
  tooltipClassName?: string
  overflowClassName?: string
}) {
  const textRef = useRef<HTMLSpanElement | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const measureOverflow = useCallback(() => {
    const element = textRef.current
    if (!element) return
    setIsOverflowing(element.scrollWidth > element.clientWidth)
  }, [])

  useEffect(() => {
    measureOverflow()
    const element = textRef.current
    let active = true
    if (typeof document !== 'undefined')
      void document.fonts?.ready.then(() => {
        if (active) measureOverflow()
      })
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureOverflow)
    if (element) resizeObserver?.observe(element)
    return () => {
      active = false
      resizeObserver?.disconnect()
    }
  }, [measureOverflow, value])

  const textNode = (
    <span
      ref={textRef}
      onPointerEnter={measureOverflow}
      onFocus={measureOverflow}
      tabIndex={isOverflowing ? 0 : undefined}
      className={cn(
        'block min-w-0 truncate rounded-sm outline-none',
        isOverflowing && 'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        isOverflowing && overflowClassName,
        className,
      )}
    >
      {value}
    </span>
  )

  return (
    // Keeping the trigger mounted preserves resize observation when clipping changes.
    <Tooltip disableHoverableContent={!isOverflowing}>
      <TooltipTrigger asChild>{textNode}</TooltipTrigger>
      {isOverflowing ? (
        <TooltipContent
          side="top"
          sideOffset={4}
          collisionPadding={12}
          className={cn('max-w-96 text-left break-all', tooltipClassName)}
        >
          {value}
        </TooltipContent>
      ) : null}
    </Tooltip>
  )
}
