import * as React from 'react'

import { type ControlSize, controlSizeClassNames } from '@/components/ui/control-size'
import { cn } from '@/lib/utils'

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: ControlSize
}

export function clampDateInputYear(value: string): string {
  return value.replace(/^(\d{4})\d+(?=-\d{2}-\d{2})/, '$1')
}

function Input({ className, type, size = 'lg', ...props }: InputProps) {
  const isDate = type === 'date'
  const isDateTimeLocal = type === 'datetime-local'
  const defaultMin = isDate ? '1970-01-01' : isDateTimeLocal ? '1970-01-01T00:00' : undefined
  const defaultMax = isDate ? '9999-12-31' : isDateTimeLocal ? '9999-12-31T23:59' : undefined

  return (
    <input
      type={type}
      min={defaultMin}
      max={defaultMax}
      data-slot="input"
      data-size={size}
      className={cn(
        'control-bordered border-input selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground dark:bg-input/30 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        controlSizeClassNames[size],
        className,
      )}
      {...props}
      onChange={
        props.onChange
          ? (event) => {
              if ((isDate || isDateTimeLocal) && event.target.value) {
                const clamped = clampDateInputYear(event.target.value)
                if (clamped !== event.target.value) {
                  event.target.value = clamped
                }
              }
              props.onChange?.(event)
            }
          : undefined
      }
    />
  )
}

export { Input }
