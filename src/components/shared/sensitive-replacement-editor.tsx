import { useId, useRef, useState } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import {
  type ReplacementKind,
  type ReplacementRow,
  replacementIssues,
} from '@/lib/api/management/sensitive-replacements'

export function SensitiveReplacementEditor({
  kind,
  title,
  rows = [],
  disabled,
  onChange,
}: {
  kind: ReplacementKind
  title: string
  rows?: ReplacementRow[] | null
  disabled: boolean
  onChange: (rows: ReplacementRow[]) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const root = useRef<HTMLFieldSetElement>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const focusAfterRemoval = useRef<number | null>(null)
  const literal = kind === 'literalReplacements'
  const issues = replacementIssues(kind, rows ?? [])
  const focusRow = (index: number) => {
    requestAnimationFrame(() => {
      const control =
        root.current?.querySelectorAll<HTMLTextAreaElement>('textarea[data-match]')[index] ??
        root.current?.querySelector<HTMLButtonElement>('button[data-add]')
      control?.focus()
    })
  }
  const move = (index: number, direction: number) => {
    if (!rows) return
    const next = [...rows]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    focusRow(target)
  }
  return (
    <fieldset
      ref={root}
      aria-labelledby={id + '-title'}
      className="grid min-w-0 gap-3 rounded-md border p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p id={id + '-title'} className="text-sm font-medium">
            {title}
          </p>
          <p id={id + '-hint'} className="text-muted-foreground text-meta mt-1">
            {t(literal ? 'sensitiveReplacements.literalHint' : 'sensitiveReplacements.patternHint')}
          </p>
        </div>
        {rows && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-add
            disabled={disabled}
            onClick={() => {
              onChange([...rows, { pattern: '', replacement: '' }])
              focusRow(rows.length)
            }}
          >
            <Plus aria-hidden="true" />
            {t(literal ? 'sensitiveReplacements.addLiteral' : 'sensitiveReplacements.addPattern')}
          </Button>
        )}
      </div>
      {rows === null && (
        <p className="text-muted-foreground text-meta">{t('sensitiveReplacements.unsupported')}</p>
      )}
      {rows?.map((row, index) => {
        const position = { index: index + 1 }
        const matchLabel = t(
          literal ? 'sensitiveReplacements.literalRow' : 'sensitiveReplacements.patternRow',
          position,
        )
        const issue = issues[index]
        const errorId = id + '-error-' + index
        const skipped = !literal && !row.pattern?.trim()
        const change = (field: keyof ReplacementRow, value: string) =>
          onChange(rows.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
        return (
          <div
            key={index}
            role="group"
            aria-label={matchLabel}
            className="grid min-w-0 gap-2 border-t pt-3"
          >
            <div className={formGridClassName}>
              <label className={fieldClassName}>
                <span>{matchLabel}</span>
                <Textarea
                  rows={1}
                  className="font-mono"
                  spellCheck={false}
                  data-match
                  value={row.pattern ?? ''}
                  disabled={disabled}
                  aria-label={matchLabel}
                  aria-required={literal || undefined}
                  aria-invalid={Boolean(issue)}
                  aria-describedby={issue || skipped ? errorId : id + '-hint'}
                  onChange={(event) => change('pattern', event.target.value)}
                />
                {skipped && (
                  <span id={errorId} className="text-muted-foreground text-meta">
                    {t('sensitiveReplacements.blankPattern')}
                  </span>
                )}
                {issue && (
                  <span id={errorId} className="text-destructive text-meta">
                    {t(`sensitiveReplacements.${issue}`)}
                  </span>
                )}
              </label>
              <label className={fieldClassName}>
                <span>{t('sensitiveReplacements.replacement')}</span>
                <Textarea
                  rows={1}
                  className="font-mono"
                  spellCheck={false}
                  disabled={disabled}
                  aria-label={t('sensitiveReplacements.replacementRow', position)}
                  value={row.replacement ?? ''}
                  placeholder={t('sensitiveReplacements.emptyDeletes')}
                  onChange={(event) => change('replacement', event.target.value)}
                />
              </label>
            </div>
            <RowActions
              className="justify-self-end"
              menuLabel={matchLabel}
              actions={[
                !literal &&
                  rows.length > 1 && {
                    id: 'up',
                    icon: ArrowUp,
                    label: t('sensitiveReplacements.up'),
                    disabled: disabled || index === 0,
                    onSelect: () => move(index, -1),
                  },
                !literal &&
                  rows.length > 1 && {
                    id: 'down',
                    icon: ArrowDown,
                    label: t('sensitiveReplacements.down'),
                    disabled: disabled || index === rows.length - 1,
                    onSelect: () => move(index, 1),
                  },
                {
                  id: 'remove',
                  tone: 'destructive',
                  icon: Trash2,
                  label: t('sensitiveReplacements.remove'),
                  ariaLabel: t('sensitiveReplacements.removeRow', position),
                  disabled,
                  onSelect: () => setRemoving(index),
                },
              ]}
            />
          </div>
        )
      })}
      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            if (focusAfterRemoval.current === null) return
            event.preventDefault()
            focusRow(focusAfterRemoval.current)
            focusAfterRemoval.current = null
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('sensitiveReplacements.removeRow', { index: (removing ?? 0) + 1 })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('sensitiveReplacements.removeHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={disabled}
              onClick={() => {
                if (rows && removing !== null) {
                  focusAfterRemoval.current = Math.min(removing, rows.length - 2)
                  onChange(rows.filter((_, i) => i !== removing))
                }
                setRemoving(null)
              }}
            >
              {t('sensitiveReplacements.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </fieldset>
  )
}
