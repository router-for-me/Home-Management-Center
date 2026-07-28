import { type ReactNode, useEffect, useRef, useState } from 'react'

import { ClipboardCheck, ClipboardX, Copy, WrapText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLocalStoragePreference } from '@/hooks/use-local-storage-preference'
import { normalizeBooleanPreference, uiPreferenceKeys } from '@/lib/ui-preferences'
import { cn } from '@/lib/utils'

async function copyText(value: string) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Local management consoles may run on an insecure HTTP origin.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Copy command failed')
}

function CopyValueButton({
  value,
  copyLabel,
  copiedLabel,
}: {
  value: string
  copyLabel: string
  copiedLabel: string
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    },
    [],
  )

  const handleCopy = async () => {
    try {
      await copyText(value)
    } catch {
      setStatus('failed')
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = window.setTimeout(() => setStatus('idle'), 1600)
      return
    }
    setStatus('copied')
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => setStatus('idle'), 1600)
  }

  const label =
    status === 'copied' ? copiedLabel : status === 'failed' ? t('actions.copyFailed') : copyLabel

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="text"
          size="icon-xs"
          className="mt-0.5"
          aria-label={label}
          onClick={() => void handleCopy()}
        >
          {status === 'copied' ? (
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
          ) : status === 'failed' ? (
            <ClipboardX className="text-destructive size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
      <span className="sr-only" aria-live="polite">
        {status === 'idle' ? '' : label}
      </span>
    </Tooltip>
  )
}

function DiagnosticDetailField({
  children,
  className,
  copiedLabel,
  copyLabel,
  copyValue,
  label,
  mono = false,
}: {
  children: ReactNode
  className?: string
  copiedLabel?: string
  copyLabel?: string
  copyValue?: string | null
  label: string
  mono?: boolean
}) {
  const copyConfig =
    copyValue && copyLabel && copiedLabel ? { value: copyValue, copyLabel, copiedLabel } : null

  return (
    <div className={cn('min-w-0 overflow-hidden rounded-md border px-3 py-2', className)}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 flex min-w-0 items-start gap-1.5">
        <div
          className={cn(
            'min-w-0 flex-1 text-sm leading-5',
            copyConfig && 'max-h-24 overflow-x-hidden overflow-y-auto',
            mono ? 'font-mono text-xs break-all' : '[overflow-wrap:anywhere]',
          )}
        >
          {children}
        </div>
        {copyConfig ? <CopyValueButton {...copyConfig} /> : null}
      </div>
    </div>
  )
}

function TechnicalTextViewer({
  content,
  copiedLabel,
  copyLabel,
  maxHeightClassName,
  minHeightClassName,
  preserveLinesLabel,
  wrapLinesLabel,
}: {
  content: string
  copiedLabel: string
  copyLabel: string
  maxHeightClassName: string
  minHeightClassName?: string
  preserveLinesLabel: string
  wrapLinesLabel: string
}) {
  const [wrapLines, setWrapLines] = useLocalStoragePreference(
    uiPreferenceKeys.technicalTextWrap,
    true,
    normalizeBooleanPreference,
  )
  const wrapActionLabel = wrapLines ? preserveLinesLabel : wrapLinesLabel

  return (
    <div className="bg-muted/45 mt-2 min-w-0 overflow-hidden rounded-md border">
      <div className="flex min-h-8 items-center justify-end gap-1 border-b px-1.5 py-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={wrapLines ? 'secondary' : 'text'}
              size="icon-xs"
              aria-label={wrapActionLabel}
              aria-pressed={wrapLines}
              onClick={() => setWrapLines((current) => !current)}
            >
              <WrapText className="size-3.5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{wrapActionLabel}</TooltipContent>
        </Tooltip>
        <CopyValueButton value={content} copyLabel={copyLabel} copiedLabel={copiedLabel} />
      </div>
      <pre
        className={cn(
          'text-foreground overflow-auto p-3 font-mono text-xs leading-5',
          maxHeightClassName,
          minHeightClassName,
          wrapLines ? '[overflow-wrap:anywhere] break-words whitespace-pre-wrap' : 'whitespace-pre',
        )}
      >
        {content}
      </pre>
    </div>
  )
}

export { DiagnosticDetailField, TechnicalTextViewer }
