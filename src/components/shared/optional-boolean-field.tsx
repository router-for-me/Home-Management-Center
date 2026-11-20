import { useId } from 'react'

import { fieldClassName } from '@/components/shared/form-layout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function OptionalBooleanField({
  label,
  value,
  defaultLabel,
  onLabel,
  offLabel,
  description,
  disabled,
  onChange,
}: {
  label: string
  value?: boolean | null
  defaultLabel: string
  onLabel: string
  offLabel: string
  description?: string
  disabled: boolean
  onChange: (value: boolean | null) => void
}) {
  const id = useId()
  return (
    <div className={fieldClassName}>
      <label htmlFor={id}>{label}</label>
      <Select
        value={value == null ? 'default' : value ? 'on' : 'off'}
        disabled={disabled}
        onValueChange={(mode) => onChange(mode === 'default' ? null : mode === 'on')}
      >
        <SelectTrigger id={id} aria-describedby={description ? id + '-hint' : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{defaultLabel}</SelectItem>
          <SelectItem value="off">{offLabel}</SelectItem>
          <SelectItem value="on">{onLabel}</SelectItem>
        </SelectContent>
      </Select>
      {description && (
        <p id={id + '-hint'} className="text-muted-foreground text-xs leading-5 font-normal">
          {description}
        </p>
      )}
    </div>
  )
}
