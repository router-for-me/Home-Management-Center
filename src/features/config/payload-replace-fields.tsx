import { useId, useState } from 'react'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  type PayloadReplaceContent,
  type PayloadReplacementEntry,
  getPayloadReplaceIssues,
} from '@/lib/api/management/payload-replace'

function PayloadReplaceFields({
  value,
  disabled,
  onChange,
}: {
  value: PayloadReplaceContent
  disabled: boolean
  onChange: (value: PayloadReplaceContent) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [removingIndex, setRemovingIndex] = useState<number | null>(null)
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
  }

  return (
    <>
      <div className="grid min-w-0 gap-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-label">{t('configPage.payload.replace.target')}</p>
          <code className="bg-muted text-muted-foreground text-code rounded px-1.5 py-0.5">
            user
          </code>
        </div>
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
          <label className={fieldClassName}>
            <span>{t('configPage.payload.replace.positions')}</span>
            <Input
              value={value.target.positions}
              disabled={disabled}
              className="font-mono sm:max-w-xs"
              placeholder={t('configPage.payload.replace.positionsPlaceholder')}
              aria-label={t('configPage.payload.replace.positions')}
              aria-invalid={Boolean(positionIssue)}
              aria-describedby={positionIssue ? `${id}-positions-error` : undefined}
              onChange={(event) =>
                onChange({ ...value, target: { ...value.target, positions: event.target.value } })
              }
            />
            {positionIssue ? (
              <span
                id={`${id}-positions-error`}
                className="text-destructive text-meta"
                role="alert"
              >
                {t(`configPage.payload.ruleIssues.${positionIssue}`)}
              </span>
            ) : null}
          </label>
        ) : null}
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.replace.positionsHint')}
        </p>
      </div>

      <div className="grid min-w-0 gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-label">{t('configPage.payload.replace.replacements')}</p>
          <span className="text-muted-foreground text-meta">
            {t('configPage.payload.replace.orderHint')}
          </span>
        </div>
        {value.replacements.map((entry, index) => {
          const sourceInvalid = entry.from.length === 0 && entry.to.length > 0
          const entryLabel = t('configPage.payload.replace.entryTitle', { index: index + 1 })
          return (
            <div
              key={index}
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
                    {
                      id: 'up',
                      label: t('configPage.payload.replace.moveUp'),
                      ariaLabel: t('configPage.payload.replace.moveEntryUp', { index: index + 1 }),
                      icon: ArrowUp,
                      disabled: disabled || index === 0,
                      onSelect: () => moveEntry(index, -1),
                    },
                    {
                      id: 'down',
                      label: t('configPage.payload.replace.moveDown'),
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
              <div className={formGridClassName}>
                <label className={fieldClassName}>
                  <span>{t('configPage.payload.replace.from')}</span>
                  <Textarea
                    value={entry.from}
                    disabled={disabled}
                    rows={2}
                    className="font-mono"
                    aria-label={t('configPage.payload.replace.entryFrom', { index: index + 1 })}
                    aria-invalid={sourceInvalid}
                    placeholder={t('configPage.payload.replace.fromPlaceholder')}
                    onChange={(event) => updateEntry(index, { from: event.target.value })}
                  />
                  {sourceInvalid ? (
                    <span className="text-destructive text-meta" role="alert">
                      {t('configPage.payload.ruleIssues.replaceSourceRequired')}
                    </span>
                  ) : null}
                </label>
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
          type="button"
          variant="outline"
          size="md"
          className="w-full sm:w-fit"
          disabled={disabled || value.replacements.some((entry) => entry.from.length === 0)}
          onClick={() =>
            onChange({ ...value, replacements: [...value.replacements, { from: '', to: '' }] })
          }
        >
          <Plus aria-hidden="true" />
          {t('configPage.payload.replace.addEntry')}
        </Button>
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.replace.literalHint')}
        </p>
      </div>

      <AlertDialog
        open={removingIndex !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingIndex(null)
        }}
      >
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
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
                if (removingIndex !== null)
                  onChange({
                    ...value,
                    replacements: value.replacements.filter((_, index) => index !== removingIndex),
                  })
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
  rules,
  disabled,
}: {
  rules: PayloadReplaceContent[]
  disabled: boolean
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [ruleIndex, setRuleIndex] = useState(0)
  const selectedIndex = Math.min(ruleIndex, Math.max(rules.length - 1, 0))
  const rule = rules[selectedIndex]
  const valid =
    rule &&
    rule.replacements.length > 0 &&
    rule.replacements.every((entry) => entry.from.length > 0)
  let result = text
  if (valid) {
    for (const { from, to } of rule.replacements) result = result.split(from).join(to)
  }

  return (
    <details className="grid gap-3 border-t pt-3">
      <summary className="text-label w-fit cursor-pointer">
        {t('configPage.payload.replace.previewTitle')}
      </summary>
      <div className="mt-3 grid min-w-0 gap-3">
        <p className="text-muted-foreground text-meta">
          {t('configPage.payload.replace.previewHint')}
        </p>
        {rules.length > 1 ? (
          <label className={fieldClassName}>
            <span>{t('configPage.payload.replace.previewRule')}</span>
            <Select
              value={String(selectedIndex)}
              disabled={disabled}
              onValueChange={(value) => setRuleIndex(Number(value))}
            >
              <SelectTrigger
                className="sm:max-w-xs"
                aria-label={t('configPage.payload.replace.previewRule')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rules.map((_, index) => (
                  <SelectItem key={index} value={String(index)}>
                    {t('configPage.payload.ruleTitle', { index: index + 1 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}
        <div className={formGridClassName}>
          <label className={fieldClassName}>
            <span>{t('configPage.payload.replace.previewInput')}</span>
            <Textarea
              value={text}
              rows={4}
              className="font-mono"
              disabled={disabled}
              placeholder={t('configPage.payload.replace.previewPlaceholder')}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className={fieldClassName}>
            <span>{t('configPage.payload.replace.previewOutput')}</span>
            <output
              aria-label={t('configPage.payload.replace.previewOutput')}
              aria-live="polite"
              className="bg-muted/20 text-body block min-w-0 rounded-md border p-3 font-mono break-words whitespace-pre-wrap"
            >
              {!valid
                ? t('configPage.payload.replace.previewIncomplete')
                : !text
                  ? t('configPage.payload.replace.previewEmpty')
                  : result || t('configPage.payload.replace.emptyResult')}
            </output>
          </div>
        </div>
      </div>
    </details>
  )
}

export { PayloadReplaceFields, PayloadReplacePreview }
