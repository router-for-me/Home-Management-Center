import * as React from 'react'

import { type VariantProps, cva } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { controlSquareStepClassNames, controlStepClassNames } from '@/components/ui/control-size'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40',
        warning:
          'border border-warning/45 bg-warning/12 text-warning-foreground hover:border-warning/60 hover:bg-warning/18 focus-visible:border-warning focus-visible:ring-warning/30 dark:text-warning dark:hover:bg-warning/16',
        outline:
          'control-bordered border bg-background shadow-xs dark:border-input dark:bg-input/30',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        // An open menu keeps its trigger emphasised, using the same foreground
        // move as the hover rather than inventing a second signal for it.
        text: 'bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=open]:text-foreground',
        destructiveText:
          'bg-transparent text-destructive shadow-none hover:bg-transparent hover:text-destructive/85 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      // The step supplies height, padding, gap, radius, type and icon size. What
      // stays here is only where this component deliberately differs: the wider
      // padding on the two largest steps, and the tighter padding an icon earns.
      size: {
        xs: `${controlStepClassNames.xs} has-[>svg]:px-1.5`,
        sm: controlStepClassNames.sm,
        md: `${controlStepClassNames.md} has-[>svg]:px-2.5`,
        lg: `${controlStepClassNames.lg} px-4 has-[>svg]:px-3`,
        xl: `${controlStepClassNames.xl} px-6 has-[>svg]:px-4`,
        'icon-xs': controlSquareStepClassNames.xs,
        'icon-sm': controlSquareStepClassNames.sm,
        'icon-md': controlSquareStepClassNames.md,
        'icon-lg': controlSquareStepClassNames.lg,
        'icon-xl': controlSquareStepClassNames.xl,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'lg',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'lg',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
