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
import { cn } from '@/lib/utils'

export type SelectInputGroupOption = {
  value: string
  label: ReactNode
}

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
  onInputValueChange,
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
  onSelectValueChange: (value: string) => void
  onInputValueChange: (value: string) => void
}) {
  return (
    <div className={cn('flex w-full min-w-0 sm:w-[22rem]', className)}>
      <Select value={selectValue} disabled={disabled} onValueChange={onSelectValueChange}>
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
          value={inputValue}
          disabled={disabled}
          placeholder={inputPlaceholder}
          aria-label={inputAriaLabel}
          onChange={(event) => onInputValueChange(event.target.value)}
        />
      </div>
    </div>
  )
}
