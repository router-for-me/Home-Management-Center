import * as React from 'react'

import { type VariantProps, cva } from 'class-variance-authority'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'

import { controlSizeClassNames } from '@/components/ui/control-size'
import { cn } from '@/lib/utils'

const toggleGroupItemVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none transition-[background-color,color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=off]:hover:bg-accent/70 data-[state=off]:hover:text-accent-foreground data-[state=off]:hover:shadow-xs data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      size: {
        default: `${controlSizeClassNames.default} px-3`,
        sm: `${controlSizeClassNames.sm} px-2.5 text-xs`,
        lg: `${controlSizeClassNames.lg} px-4`,
      },
      variant: {
        default: '',
        outline: 'border border-transparent data-[state=on]:border-primary/30',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  },
)

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleGroupItemVariants>>({
  size: 'default',
  variant: 'default',
})

function ToggleGroup({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleGroupItemVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        'bg-muted/50 inline-flex items-center gap-1 rounded-md border p-1 shadow-xs',
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleGroupItemVariants>) {
  const context = React.useContext(ToggleGroupContext)
  const resolvedSize = size ?? context.size ?? 'default'
  const resolvedVariant = variant ?? context.variant ?? 'default'

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-size={resolvedSize}
      data-variant={resolvedVariant}
      className={cn(
        toggleGroupItemVariants({
          variant: resolvedVariant,
          size: resolvedSize,
        }),
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
