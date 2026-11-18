import { type FocusEvent, type ReactNode, createContext, useContext, useId, useState } from 'react'

import { fieldClassName } from '@/components/shared/form-layout'
import { cn } from '@/lib/utils'

const PayloadReviewFieldContext = createContext<string | null>(null)

type PayloadFieldControl = {
  id: string
  'aria-label': string
  'aria-invalid': boolean
  'aria-required'?: boolean
  'aria-describedby'?: string
  'data-draft-missing'?: true
  onBlur: (event: FocusEvent<HTMLElement>) => void
}

function PayloadFormField({
  controlId,
  label,
  labelClassName,
  error,
  required,
  hint,
  hintId,
  children,
}: {
  controlId?: string
  label: string
  labelClassName?: string
  error?: string | null
  required?: boolean
  hint?: string
  hintId?: string
  children: (control: PayloadFieldControl) => ReactNode
}) {
  const generatedId = useId()
  const id = controlId ?? generatedId
  const [visited, setVisited] = useState(false)
  const reviewedId = useContext(PayloadReviewFieldContext)
  const showError = Boolean(error && (visited || reviewedId === id))
  const descriptionId = hintId ?? (hint ? `${id}-hint` : undefined)
  const descriptions = [showError && `${id}-error`, descriptionId].filter(Boolean)

  return (
    <label htmlFor={id} className={cn(fieldClassName, 'min-w-0 self-start')}>
      <span className={cn('text-label', labelClassName)}>{label}</span>
      {children({
        id,
        'aria-label': label,
        'aria-invalid': showError,
        'aria-required': required,
        'aria-describedby': descriptions.join(' ') || undefined,
        'data-draft-missing': error ? true : undefined,
        onBlur: (event) => {
          if (
            event.relatedTarget instanceof Element &&
            event.relatedTarget.closest('[data-payload-mode]')
          )
            return
          setVisited(true)
        },
      })}
      {showError ? (
        <span id={`${id}-error`} className="text-destructive text-meta font-normal" role="alert">
          {error}
        </span>
      ) : null}
      {hint ? (
        <span id={descriptionId} className="text-muted-foreground text-meta font-normal">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

export { PayloadFormField, PayloadReviewFieldContext }
