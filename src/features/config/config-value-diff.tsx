import { useMemo, useState } from 'react'

import { type ChangeObject, diffJson, diffLines, diffWordsWithSpace } from 'diff'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DiffFormat = 'value' | 'json' | 'text'
type DiffGroup = {
  kind: 'removed' | 'added' | 'context'
  lines: string[]
  oldStart: number
  newStart: number
  words?: ChangeObject<string>[]
}

const contextLines = 3
const marker = { removed: '−', added: '+', context: ' ' }
const tint = {
  removed: 'bg-destructive/10',
  added: 'bg-success/12',
  context: '',
}

function groupLines(before: string, after: string, format: DiffFormat): DiffGroup[] | undefined {
  const options = { timeout: 100 }
  const chunks =
    format === 'value'
      ? [
          { value: before, removed: true, added: false },
          { value: after, removed: false, added: true },
        ]
      : format === 'json'
        ? diffJson(before, after, options)
        : diffLines(before, after, options)
  let oldLine = 1
  let newLine = 1
  if (!chunks) return
  const groups = chunks.map<DiffGroup>(({ value, removed, added }) => {
    const lines = value.replace(/\r?\n$/, '').split(/\r?\n/)
    const oldStart = oldLine
    const newStart = newLine
    if (!added) oldLine += lines.length
    if (!removed) newLine += lines.length
    return { kind: removed ? 'removed' : added ? 'added' : 'context', lines, oldStart, newStart }
  })
  // A single removed line followed by a single added line is an unambiguous pair.
  for (let index = 1; index < groups.length; index++) {
    const old = groups[index - 1]
    const next = groups[index]
    if (
      old.kind !== 'removed' ||
      next.kind !== 'added' ||
      old.lines.length !== 1 ||
      next.lines.length !== 1
    )
      continue
    const words = diffWordsWithSpace(old.lines[0], next.lines[0], { maxEditLength: 32 })
    if (words?.some((part) => !part.added && !part.removed && part.value.trim())) {
      old.words = words.filter((part) => !part.added)
      next.words = words.filter((part) => !part.removed)
    }
  }
  return groups
}

function DiffLines({
  group: { kind, lines, oldStart, newStart, words },
  first,
  last,
  numbered,
}: {
  group: DiffGroup
  first: boolean
  last: boolean
  numbered: boolean
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const head = first ? 0 : contextLines
  const tail = last ? 0 : contextLines
  const hidden = kind === 'context' ? lines.length - head - tail : 0
  const Value = kind === 'removed' ? 'del' : kind === 'added' ? 'ins' : 'span'
  const label = kind === 'context' ? null : t(`configPage.diff.${kind}`)

  function renderLines(start: number, end: number) {
    return lines.slice(start, end).map((line, offset) => {
      const index = start + offset
      return (
        <div
          key={index}
          className={cn('col-span-full grid grid-cols-subgrid items-baseline py-0.5', tint[kind])}
        >
          {numbered && (
            <>
              <span
                aria-hidden="true"
                className="text-muted-foreground pl-3 text-right select-none"
              >
                {kind !== 'added' && oldStart + index}
              </span>
              <span aria-hidden="true" className="text-muted-foreground text-right select-none">
                {kind !== 'removed' && newStart + index}
              </span>
            </>
          )}
          <span
            aria-hidden="true"
            className={cn(
              'text-center font-semibold select-none',
              !numbered && 'pl-3',
              kind === 'removed' && 'text-red-800 dark:text-red-300',
              kind === 'added' && 'text-emerald-800 dark:text-emerald-300',
            )}
          >
            {marker[kind]}
          </span>
          <code className="min-w-0 pr-3 wrap-anywhere whitespace-pre-wrap">
            {label && <span className="sr-only select-none">{label} </span>}
            <Value className="no-underline">
              {words
                ? words.map((word, wordIndex) =>
                    word.added || word.removed ? (
                      <mark
                        key={wordIndex}
                        className={cn(
                          'rounded-xs font-semibold text-inherit',
                          word.added ? 'bg-success/25' : 'bg-destructive/20',
                        )}
                      >
                        {word.value}
                      </mark>
                    ) : (
                      word.value
                    ),
                  )
                : line || '\u00a0'}
            </Value>
          </code>
        </div>
      )
    })
  }

  if (hidden <= contextLines) return renderLines(0, lines.length)
  return (
    <>
      {renderLines(0, head)}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={expanded}
        className="bg-muted/50 text-muted-foreground col-span-full w-full justify-start rounded-none font-sans"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronsDownUp aria-hidden="true" /> : <ChevronsUpDown aria-hidden="true" />}
        {t(expanded ? 'configPage.diff.collapseLines' : 'configPage.diff.expandLines', {
          count: hidden,
        })}
      </Button>
      {expanded && renderLines(head, lines.length - tail)}
      {renderLines(lines.length - tail, lines.length)}
    </>
  )
}

export function ConfigValueDiff({
  before,
  after,
  format = 'value',
}: {
  before: string
  after: string
  format?: DiffFormat
}) {
  const { t } = useTranslation()
  const groups = useMemo(() => groupLines(before, after, format), [before, after, format])
  if (!groups) {
    return (
      <div className="grid gap-2 px-3 py-2">
        <p className="text-muted-foreground text-meta">{t('configPage.diff.fullValues')}</p>
        {(
          [
            ['removed', before],
            ['added', after],
          ] as const
        ).map(([kind, value]) => (
          <div key={kind} className={cn('min-w-0 rounded p-2', tint[kind])}>
            <p className="text-label">
              {marker[kind]} {t(`configPage.diff.${kind}`)}
            </p>
            <pre className="text-code wrap-anywhere whitespace-pre-wrap">{value}</pre>
          </div>
        ))}
      </div>
    )
  }
  if (groups.every(({ kind }) => kind === 'context')) {
    return (
      <p className="text-muted-foreground text-meta px-3 py-2">{t('configPage.diff.sameValue')}</p>
    )
  }

  const numbered = before.includes('\n') || after.includes('\n')
  return (
    <div
      className={cn(
        'bg-background/40 text-foreground text-code grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 py-1',
        numbered && 'grid-cols-[auto_auto_auto_minmax(0,1fr)]',
      )}
    >
      {groups.map((group, index) => (
        <DiffLines
          key={`${group.kind}-${group.oldStart}-${group.newStart}`}
          group={group}
          first={index === 0}
          last={index === groups.length - 1}
          numbered={numbered}
        />
      ))}
    </div>
  )
}
