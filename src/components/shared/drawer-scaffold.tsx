import type { ComponentProps } from 'react'

import {
  SheetContent,
  SheetFooter,
  SheetHeader,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

function DrawerScaffoldContent({
  className,
  ...props
}: ComponentProps<typeof SheetContent>) {
  return (
    <SheetContent
      className={cn('w-full gap-0 overflow-hidden p-0', className)}
      {...props}
    />
  )
}

function DrawerScaffoldHeader({
  className,
  ...props
}: ComponentProps<typeof SheetHeader>) {
  return (
    <SheetHeader
      className={cn(
        'bg-popover shrink-0 border-b p-5 shadow-[0_1px_0_var(--border)]',
        className,
      )}
      {...props}
    />
  )
}

function DrawerScaffoldBody({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-scaffold-body"
      className={cn('min-h-0 flex-1 overflow-y-auto p-5', className)}
      {...props}
    />
  )
}

function DrawerScaffoldFooter({
  className,
  ...props
}: ComponentProps<typeof SheetFooter>) {
  return (
    <SheetFooter
      className={cn(
        'bg-popover shrink-0 border-t p-4 shadow-[0_-1px_0_var(--border)] sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

export {
  DrawerScaffoldBody,
  DrawerScaffoldContent,
  DrawerScaffoldFooter,
  DrawerScaffoldHeader,
}
