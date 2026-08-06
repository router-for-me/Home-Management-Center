import * as React from 'react'

import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('min-w-0', className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'border-border/80 flex w-fit max-w-full items-center gap-1 overflow-x-auto border-b',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // The step carries height, inline padding and type, including the touch
        // floor a tab trigger used to opt into by hand.
        'control-md',
        'text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 after:bg-primary data-[state=active]:bg-primary/8 data-[state=active]:text-foreground relative inline-flex shrink-0 items-center justify-center gap-2 rounded-t-md font-medium whitespace-nowrap transition-[background-color,color,box-shadow] outline-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:transition-transform focus-visible:ring-[3px] focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 data-[state=active]:after:scale-x-100 motion-reduce:transition-none motion-reduce:after:transition-none',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'focus-visible:ring-ring/50 min-w-0 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
