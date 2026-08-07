import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { useDebouncedFilterValue } from '@/hooks/use-debounced-filter-value'

/**
 * An input bound to a filter that drives a query key. It owns its draft, so a
 * keystroke re-renders this input rather than the toolbar around it, and the
 * filter only moves once the user stops typing.
 */
export function DebouncedFilterInput({
  value,
  onCommit,
  ...inputProps
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onKeyDown'> & {
  value: string
  onCommit: (value: string) => void
}) {
  const draft = useDebouncedFilterValue({ value, onCommit })

  return (
    <Input
      {...inputProps}
      value={draft.value}
      onChange={(event) => draft.onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        draft.flush()
      }}
    />
  )
}
