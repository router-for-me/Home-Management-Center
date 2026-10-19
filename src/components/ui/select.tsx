import * as React from 'react'

import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'

import { type ControlSize, controlSizeClassNames } from '@/components/ui/control-size'
import { cn } from '@/lib/utils'

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return (
    <SelectPrimitive.Root
      data-slot="select"
      {...props}
      onValueChange={
        props.onValueChange
          ? (value) => {
              // Radix SelectBubbleInput dispatches a synthetic change event on its hidden
              // <select> when controlled `value` updates inside a <form>. If the matching
              // <option> has not mounted yet, the DOM <select> reports `""`, even though
              // SelectItem forbids empty-string values. Ignore empty-string bubble resets.
              if (value === '') return
              props.onValueChange?.(value)
            }
          : undefined
      }
    />
  )
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

// A truncated value hides exactly the tail that tells two long ids apart, so the
// trigger carries the full string as a native tooltip. Reading it on hover keeps
// the measurement accurate without observing every layout change, and the value
// element itself cannot host the tooltip because Radix marks it pointer-events
// none.
function syncSelectOverflowTitle(trigger: HTMLElement) {
  const value = trigger.querySelector<HTMLElement>('[data-slot="select-value"]')
  const text = value?.textContent?.trim() ?? ''

  if (value && text && value.scrollWidth > value.clientWidth) trigger.setAttribute('title', text)
  else trigger.removeAttribute('title')
}

function SelectTrigger({
  className,
  size = 'lg',
  children,
  onPointerEnter,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: ControlSize
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      // Two traps live in the value-box classes below. `line-clamp` cannot be
      // used: it needs `display: -webkit-box`, so any `flex` on the same
      // element silently disables the clamp and the value wraps out of a
      // fixed-height trigger. And truncation only engages when the box may
      // shrink, hence `min-w-0`; the chevron stays outside it so it is never
      // clipped.
      className={cn(
        "control-bordered border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:truncate *:data-[slot=select-value]:text-start [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        controlSizeClassNames[size],
        className,
      )}
      onPointerEnter={(event) => {
        if (props.title === undefined) syncSelectOverflowTitle(event.currentTarget)
        onPointerEnter?.(event)
      }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          // The list may grow past the trigger so a value the trigger has to
          // truncate stays readable where it is chosen, but never past the
          // space the viewport actually has.
          'bg-popover text-popover-foreground data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in relative z-[var(--z-overlay)] max-h-(--radix-select-content-available-height) max-w-(--radix-select-content-available-width) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full min-w-0 cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:block *:[span]:last:min-w-0 *:[span]:last:flex-1 *:[span]:last:truncate",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
