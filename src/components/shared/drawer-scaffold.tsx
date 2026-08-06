import type { ComponentProps } from 'react'

import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SheetContent, SheetFooter, SheetHeader } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type DrawerScaffoldBackAction = {
  label: string
  onClick: () => void
  disabled?: boolean
}

type DrawerScaffoldHeaderProps = ComponentProps<typeof SheetHeader> & {
  back?: DrawerScaffoldBackAction
}

function DrawerScaffoldContent({ className, ...props }: ComponentProps<typeof SheetContent>) {
  // No width here any more: the sheet primitive is full-width below 40rem on its
  // own, and this override was the only thing making the two disagree.
  return <SheetContent className={cn('gap-0 overflow-hidden p-0', className)} {...props} />
}

/*
 * A form filling a drawer.
 *
 * The drawer clips what does not fit, and expects exactly one child to be the part
 * that scrolls. A form written as a plain `grid` is neither: it sizes to its own
 * content and cannot shrink, so on a short viewport the drawer cut the bottom off
 * and took the submit button with it — the form was still there, just unreachable.
 *
 * Four of the five forms in this app had that shape, which is what makes it a
 * primitive rather than a rule: `DrawerScaffoldForm` plus a Body and a Footer is
 * the only arrangement that scrolls, and now it is also the shortest one to write.
 */
function DrawerScaffoldForm({ className, ...props }: ComponentProps<'form'>) {
  return <form className={cn('flex min-h-0 flex-1 flex-col', className)} {...props} />
}

function DrawerScaffoldHeader({ back, className, children, ...props }: DrawerScaffoldHeaderProps) {
  return (
    <SheetHeader
      className={cn('bg-popover shrink-0 border-b p-5 shadow-[0_1px_0_var(--border)]', className)}
      {...props}
    >
      {back ? (
        <div className="flex min-w-0 items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            data-slot="drawer-scaffold-back-button"
            aria-label={back.label}
            disabled={back.disabled}
            onClick={back.onClick}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="grid min-h-9 min-w-0 flex-1 content-center gap-1.5">{children}</div>
        </div>
      ) : (
        children
      )}
    </SheetHeader>
  )
}

function DrawerScaffoldBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-scaffold-body"
      className={cn('min-h-0 flex-1 overflow-y-auto p-5', className)}
      {...props}
    />
  )
}

function DrawerScaffoldFooter({ className, ...props }: ComponentProps<typeof SheetFooter>) {
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
  DrawerScaffoldForm,
  DrawerScaffoldHeader,
}
