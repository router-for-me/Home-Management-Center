import * as React from 'react'

import { CheckIcon, MinusIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Unchecked, this is a bordered control and takes the shared hover.
        // Checked, it is a filled one, so it deepens its own fill the way a
        // filled button does; those utilities outrank the shared class, which is
        // what keeps the neutral tint from washing out a checked box.
        'peer control-bordered border-input data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:enabled:hover:border-primary/90 data-[state=checked]:enabled:hover:bg-primary/90 data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:enabled:hover:border-primary/90 data-[state=indeterminate]:enabled:hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:data-[state=unchecked]:bg-input/30 dark:aria-invalid:ring-destructive/40 size-4 shrink-0 rounded-[4px] border bg-transparent shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[state=unchecked]:bg-transparent',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group flex items-center justify-center text-current transition-none"
      >
        <CheckIcon
          className="size-3.5 group-data-[state=indeterminate]:hidden"
          aria-hidden="true"
        />
        <MinusIcon
          className="hidden size-3.5 group-data-[state=indeterminate]:block"
          aria-hidden="true"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
