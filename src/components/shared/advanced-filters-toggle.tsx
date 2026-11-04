import type { ComponentProps } from 'react'

import { ChevronsDown, ChevronsUp } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Opens the advanced half of a filter row. Render it as the child of a
 * `CollapsibleTrigger asChild`, which supplies the click handler and the
 * expanded state; `open` only turns the icon. It sits in the row's own cell (see
 * `filterActionsClassName`) rather than in a bar of its own.
 *
 * The label does not change with the state. A "hide advanced filters" label is
 * wider than the closed one, so the row's auto track grew on every toggle and
 * every filter beside it narrowed and widened with it. `aria-expanded`, set by
 * the trigger, already tells assistive tech which state it is in.
 */
function AdvancedFiltersToggle({
  open,
  activeCount = 0,
  label,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & {
  open: boolean
  /** Applied filters the collapsed half is hiding; shown so they are not forgotten. */
  activeCount?: number
  label: string
}) {
  return (
    <Button type="button" variant="outline" size="md" {...props}>
      {label}
      {activeCount > 0 ? (
        <span className="border-border bg-background text-foreground rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-none">
          {activeCount}
        </span>
      ) : null}
      {open ? (
        <ChevronsUp className="text-primary" aria-hidden="true" />
      ) : (
        <ChevronsDown className="text-primary" aria-hidden="true" />
      )}
    </Button>
  )
}

export { AdvancedFiltersToggle }
