import type { ReactNode } from 'react'

import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebouncedFilterValue } from '@/hooks/use-debounced-filter-value'
import { cn } from '@/lib/utils'

export type SelectInputGroupOption = {
  value: string
  label: ReactNode
}

/**
 * The search box behind this group drives a query key, so the draft lives here
 * rather than in the toolbar: a keystroke re-renders this control alone, and
 * the filter only moves once the user stops typing. Switching the field hands
 * the pending draft to the caller instead of committing it to the field being
 * left, so a mid-search switch costs one filter change rather than two.
 */
export function SelectInputGroup({
  selectValue,
  inputValue,
  options,
  selectAriaLabel,
  inputAriaLabel,
  inputPlaceholder,
  disabled,
  className,
  selectClassName,
  inputClassName,
  onSelectValueChange,
  onInputCommit,
}: {
  selectValue: string
  inputValue: string
  options: SelectInputGroupOption[]
  selectAriaLabel: string
  inputAriaLabel: string
  inputPlaceholder?: string
  disabled?: boolean
  className?: string
  selectClassName?: string
  inputClassName?: string
  onSelectValueChange: (value: string, carriedInputValue: string) => void
  onInputCommit: (value: string) => void
}) {
  const draft = useDebouncedFilterValue({ value: inputValue, onCommit: onInputCommit })

  return (
    <div className={cn('flex w-full min-w-0 sm:w-[22rem]', className)}>
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(value) => onSelectValueChange(value, draft.detach())}
      >
        <SelectTrigger
          className={cn(
            'w-auto min-w-[7.5rem] shrink-0 rounded-r-none border-r-0 shadow-xs',
            selectClassName,
          )}
          size="md"
          aria-label={selectAriaLabel}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative min-w-0 flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          size="md"
          className={cn('rounded-l-none pl-9 shadow-xs', inputClassName)}
          value={draft.value}
          disabled={disabled}
          placeholder={inputPlaceholder}
          aria-label={inputAriaLabel}
          onChange={(event) => draft.onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            draft.flush()
          }}
        />
      </div>
    </div>
  )
}
