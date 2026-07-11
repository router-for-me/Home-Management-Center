import { useCallback, useEffect, useRef, useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function OverflowTooltipText({
  value,
  className,
  tooltipClassName,
}: {
  value: string
  className?: string
  tooltipClassName?: string
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
    if (!element || typeof ResizeObserver === 'undefined') return

    const resizeObserver = new ResizeObserver(measureOverflow)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [measureOverflow, value])

  const textNode = (
    <span
      ref={textRef}
      tabIndex={isOverflowing ? 0 : undefined}
      className={cn(
        'block min-w-0 truncate rounded-sm outline-none',
        isOverflowing && 'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className,
      )}
    >
      {value}
    </span>
  )

  if (!isOverflowing) return textNode

  return (
    <Tooltip>
      <TooltipTrigger asChild>{textNode}</TooltipTrigger>
      <TooltipContent side="top" className={cn('max-w-96 text-left break-all', tooltipClassName)}>
        {value}
      </TooltipContent>
    </Tooltip>
  )
}
