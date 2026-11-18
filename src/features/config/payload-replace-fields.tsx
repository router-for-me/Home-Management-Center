import { useId, useRef, useState } from 'react'

import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { fieldClassName, formGridClassName } from '@/components/shared/form-layout'
import { RowActions } from '@/components/shared/row-actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { PayloadFormField } from '@/features/config/payload-form-field'
import { getPayloadReplacePreview } from '@/features/config/payload-replace-preview'
import {
  type PayloadReplaceContent,
  type PayloadReplacementEntry,
  getPayloadReplaceIssues,
} from '@/lib/api/management/payload-replace'
import { cn } from '@/lib/utils'

type PayloadReplaceDraft = {
  target: PayloadReplaceContent['target']
  replacements: (PayloadReplacementEntry & { id: number })[]
}

function PayloadReplaceFields({
  value,
  disabled,
  onChange,
}: {
  value: PayloadReplaceDraft
  disabled: boolean
  onChange: (value: PayloadReplaceDraft) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [removingIndex, setRemovingIndex] = useState<number | null>(null)
  const afterRemovalFocus = useRef<string | null>(null)
  const [orderFeedback, setOrderFeedback] = useState('')
  const multipleSteps = value.replacements.length > 1
  const positionIssue = getPayloadReplaceIssues(value).find((issue) =>
    issue.startsWith('replacePositions'),
  )
  const updateEntry = (index: number, patch: Partial<PayloadReplacementEntry>) => {
    onChange({
      ...value,
      replacements: value.replacements.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    })
  }
  const moveEntry = (index: number, direction: number) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= value.replacements.length) return
    const replacements = [...value.replacements]
    ;[replacements[index], replacements[nextIndex]] = [replacements[nextIndex], replacements[index]]
    onChange({ ...value, replacements })
    setOrderFeedback(t('configPage.payload.replace.stepMoved', { position: nextIndex + 1 }))
  }

  return (
    <>
      <div className="grid min-w-0 gap-3 border-t pt-4">
        <p className="text-label">{t('configPage.payload.replace.target')}</p>
        <RadioGroup
          value={value.target.all ? 'all' : 'positions'}
          disabled={disabled}
          aria-label={t('configPage.payload.replace.target')}
          className="flex flex-col gap-2 sm:flex-row sm:gap-4"
          onValueChange={(mode) =>
            onChange({ ...value, target: { ...value.target, all: mode === 'all' } })
          }
        >
          <label
            htmlFor={`${id}-positions`}
            className="text-body min-h-control-lg flex items-center gap-2"
          >
            <RadioGroupItem value="positions" id={`${id}-positions`} />
            {t('configPage.payload.replace.selectedPositions')}
          </label>
          <label
            htmlFor={`${id}-all`}
            className="text-body min-h-control-lg flex items-center gap-2"
          >
            <RadioGroupItem value="all" id={`${id}-all`} />
            {t('configPage.payload.replace.allUsers')}
          </label>
        </RadioGroup>
        {!value.target.all ? (
          <PayloadFormField
            label={t('configPage.payload.replace.positions')}
            required
            error={positionIssue && t(`configPage.payload.ruleIssues.${positionIssue}`)}
            hint={t('configPage.payload.replace.positionsHint')}
          >
            {(control) => (
              <Input
                {...control}
                value={value.target.positions}
                disabled={disabled}
                className="font-mono sm:max-w-xs"
                placeholder={t('configPage.payload.replace.positionsPlaceholder')}
                onChange={(event) =>
                  onChange({ ...value, target: { ...value.target, positions: event.target.value } })
                }
              />
            )}
          </PayloadFormField>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-3 border-t pt-4">
        <div className="grid gap-1">
          <p className="text-label">{t('configPage.payload.replace.replacements')}</p>
          {multipleSteps ? (
            <p className="text-muted-foreground text-meta">
              {t('configPage.payload.replace.stepOrderHelp')}
            </p>
          ) : null}
        </div>
        <p
          className={multipleSteps && orderFeedback ? 'text-muted-foreground text-meta' : 'sr-only'}
          role="status"
        >
          {multipleSteps && orderFeedback}
        </p>
        {value.replacements.map((entry, index) => {
          const entryLabel = t('configPage.payload.replace.entryTitle', { index: index + 1 })
          return (
            <div
              key={entry.id}
              role="group"
              aria-label={entryLabel}
              className="grid min-w-0 gap-2 border-t pt-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-label">{entryLabel}</span>
                  {entry.to.length === 0 && entry.from.length > 0 ? (
                    <span className="bg-muted text-muted-foreground text-meta rounded px-2 py-1">
                      {t('configPage.payload.replace.deletesText')}
                    </span>
                  ) : null}
                </div>
                <RowActions
                  menuLabel={entryLabel}
                  actions={[
                    multipleSteps && {
                      id: 'up',
                      label: t('configPage.payload.replace.moveStepUp'),
                      ariaLabel: t('configPage.payload.replace.moveEntryUp', { index: index + 1 }),
                      icon: ArrowUp,
                      disabled: disabled || index === 0,
                      onSelect: () => moveEntry(index, -1),
                    },
                    multipleSteps && {
                      id: 'down',
                      label: t('configPage.payload.replace.moveStepDown'),
                      ariaLabel: t('configPage.payload.replace.moveEntryDown', {
                        index: index + 1,
                      }),
                      icon: ArrowDown,
                      disabled: disabled || index === value.replacements.length - 1,
                      onSelect: () => moveEntry(index, 1),
                    },
                    {
                      id: 'delete',
                      label: t('configPage.payload.remove'),
                      ariaLabel: t('configPage.payload.replace.removeEntry', { index: index + 1 }),
                      icon: Trash2,
                      tone: 'destructive',
                      disabled,
                      onSelect: () => setRemovingIndex(index),
                    },
                  ]}
                />
              </div>
              <div className={cn(formGridClassName, 'items-start')}>
                <PayloadFormField
                  controlId={`${id}-replacement-${index}`}
                  label={t('configPage.payload.replace.from')}
                  required
                  error={
                    !entry.from.length
                      ? t('configPage.payload.ruleIssues.replaceSourceRequired')
                      : null
                  }
                  hint={index === 0 ? t('configPage.payload.replace.literalHint') : undefined}
                  hintId={`${id}-literal-hint`}
                >
                  {(control) => (
                    <Textarea
                      {...control}
                      value={entry.from}
                      disabled={disabled}
                      rows={2}
                      className="font-mono"
                      aria-label={t('configPage.payload.replace.entryFrom', { index: index + 1 })}
                      placeholder={t('configPage.payload.replace.fromPlaceholder')}
                      onChange={(event) => updateEntry(index, { from: event.target.value })}
                    />
                  )}
                </PayloadFormField>
                <label className={fieldClassName}>
                  <span>{t('configPage.payload.replace.to')}</span>
                  <Textarea
                    value={entry.to}
                    disabled={disabled}
                    rows={2}
                    className="font-mono"
                    aria-label={t('configPage.payload.replace.entryTo', { index: index + 1 })}
                    placeholder={t('configPage.payload.replace.toPlaceholder')}
                    onChange={(event) => updateEntry(index, { to: event.target.value })}
                  />
                </label>
              </div>
            </div>
          )
        })}
        <Button
          id={`${id}-add-replacement`}
          type="button"
          variant="outline"
          size="md"
          className="w-full sm:w-fit"
          disabled={disabled || value.replacements.some((entry) => entry.from.length === 0)}
          data-draft-missing={value.replacements.length === 0 || undefined}
          onClick={() => {
            const id = value.replacements.reduce((next, row) => Math.max(next, row.id + 1), 0)
            onChange({ ...value, replacements: [...value.replacements, { id, from: '', to: '' }] })
          }}
        >
          <Plus aria-hidden="true" />
          {t('configPage.payload.replace.addEntry')}
        </Button>
      </div>

      <AlertDialog
        open={removingIndex !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingIndex(null)
        }}
      >
        <AlertDialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            const targetId = afterRemovalFocus.current
            if (!targetId) return
            event.preventDefault()
            afterRemovalFocus.current = null
            window.requestAnimationFrame(() =>
              document.getElementById(targetId)?.focus({ preventScroll: true }),
            )
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('configPage.payload.replace.removeEntry', { index: (removingIndex ?? 0) + 1 })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('configPage.payload.replace.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={disabled}
              onClick={() => {
                if (removingIndex !== null) {
                  afterRemovalFocus.current =
                    value.replacements.length > 1
                      ? `${id}-replacement-${Math.min(removingIndex, value.replacements.length - 2)}`
                      : `${id}-add-replacement`
                  onChange({
                    ...value,
                    replacements: value.replacements.filter((_, index) => index !== removingIndex),
                  })
                }
                setRemovingIndex(null)
              }}
            >
              {t('configPage.payload.replace.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PayloadReplacePreview({
  rule,
  disabled,
  text,
  onTextChange,
}: {
  rule: PayloadReplaceContent
  disabled: boolean
  text: string
  onTextChange: (text: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const preview = open ? getPayloadReplacePreview(text, rule.replacements) : null
  const messages = {
    incomplete: 'previewIncomplete',
    empty: 'previewEmpty',
    tooLarge: 'previewTooLarge',
  } as const

  return (
    <details
      className="group/preview grid gap-3 border-t pt-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="text-label min-h-control-lg flex w-fit cursor-pointer flex-wrap items-center gap-2">
        <ChevronDown className="size-4 group-open/preview:rotate-180" aria-hidden="true" />
        <span>{t('configPage.payload.replace.previewTitle')}</span>
        <span className="text-muted-foreground text-meta">
          {t('configPage.payload.replace.localOnly')}
        </span>
      </summary>
      <div className="mt-3 grid min-w-0 gap-3">
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.replace.previewHint')}
        </p>
        <div className={cn(formGridClassName, 'items-start')}>
          <label className={fieldClassName}>
            <span>{t('configPage.payload.replace.previewInput')}</span>
            <Textarea
              value={text}
              rows={4}
              className="font-mono"
              disabled={disabled}
              aria-label={t('configPage.payload.replace.previewInput')}
              placeholder={t('configPage.payload.replace.previewPlaceholder')}
              onChange={(event) => onTextChange(event.target.value)}
            />
          </label>
          <div className={fieldClassName}>
            <span>{t('configPage.payload.replace.previewOutput')}</span>
            <output
              aria-label={t('configPage.payload.replace.previewOutput')}
              aria-live="polite"
              className="bg-muted/20 text-body block min-w-0 rounded-md p-3 font-mono break-words whitespace-pre-wrap"
            >
              {preview &&
                (preview.status === 'ready'
                  ? preview.result || t('configPage.payload.replace.emptyResult')
                  : t(`configPage.payload.replace.${messages[preview.status]}`))}
            </output>
          </div>
        </div>
        {preview?.status === 'ready' ? (
          <details className="group/steps">
            <summary className="text-label min-h-control-lg flex w-fit cursor-pointer items-center">
              <ChevronDown className="mr-2 size-4 group-open/steps:rotate-180" aria-hidden="true" />
              {t('configPage.payload.replace.showSteps')}
            </summary>
            <ol
              className="mt-2 grid min-w-0 gap-3"
              aria-label={t('configPage.payload.replace.showSteps')}
            >
              {preview.steps.map((step, index) => (
                <li key={index} className="grid min-w-0 gap-1">
                  <p className="text-meta flex flex-wrap gap-2">
                    <span>{t('configPage.payload.replace.entryTitle', { index: index + 1 })}</span>
                    {!step.changed ? (
                      <span className="text-muted-foreground">
                        {t('configPage.payload.replace.unchanged')}
                      </span>
                    ) : null}
                  </p>
                  <pre className="bg-muted/20 text-body min-w-0 rounded-md p-3 break-words whitespace-pre-wrap">
                    {step.result || t('configPage.payload.replace.emptyResult')}
                  </pre>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </details>
  )
}

export { type PayloadReplaceDraft, PayloadReplaceFields, PayloadReplacePreview }
