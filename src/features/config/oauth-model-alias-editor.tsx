import { useId, useState } from 'react'

import { ArrowRightLeft, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  fieldClassName,
  filterActionsClassName,
  formGridClassName,
} from '@/components/shared/form-layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type ModelAliasRule,
  aliasChannelValue,
  canEditAliasRule,
  isAliasChannel,
  normalizeModelAliasRule,
  serializeModelAliasRule,
} from '@/lib/api/management/oauth-model-aliases'

type AliasMap = Record<string, unknown>

function ReadOnlyAlias({ value }: { value: unknown }) {
  const { t } = useTranslation()
  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-muted-foreground text-sm">{t('configPage.json.unsupportedStructure')}</p>
      <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

export function ModelAliasEditor({
  value,
  availableChannels,
  disabled,
  onChange,
}: {
  value: AliasMap
  availableChannels: string[]
  disabled: boolean
  onChange: (value: AliasMap) => void
}) {
  const { t } = useTranslation()
  const [channel, setChannel] = useState<string | null>(() => Object.keys(value)[0] ?? 'claude')
  const [custom, setCustom] = useState('')
  const [move, setMove] = useState<{ index: number; destination: string } | null>(null)
  const listId = useId()
  const channels = [
    ...new Set([...Object.keys(value), ...availableChannels, ...(channel ? [channel] : [])]),
  ]
  const selected = channel ?? custom.trim()
  const stored = aliasChannelValue(value, selected)
  const rows: unknown[] | null = stored === undefined ? [] : Array.isArray(stored) ? stored : null
  const writable = isAliasChannel(selected) && rows !== null && !disabled

  function selectChannel(next: string | null) {
    setChannel(next)
    setCustom('')
    setMove(null)
  }

  function withoutRow(index: number) {
    const remaining = rows!.filter((_, i) => i !== index)
    const next = { ...value, [selected]: remaining }
    if (!remaining.length) delete next[selected]
    return next
  }

  function updateRow(index: number, raw: AliasMap, patch: ModelAliasRule) {
    onChange({
      ...value,
      [selected]: rows!.map((row, i) => (i === index ? serializeModelAliasRule(patch, raw) : row)),
    })
  }

  const destination = move?.destination.trim() ?? ''
  const existingDestination = aliasChannelValue(value, destination)
  const canMove =
    writable &&
    isAliasChannel(destination) &&
    destination !== selected &&
    (existingDestination === undefined || Array.isArray(existingDestination))
  const moveRow = () => {
    if (!move || !canMove || !rows) return
    const target: unknown[] = Array.isArray(existingDestination) ? existingDestination : []
    onChange({ ...withoutRow(move.index), [destination]: [...target, rows[move.index]] })
    selectChannel(destination)
  }

  return (
    <div className="grid gap-3">
      <div className={filterActionsClassName}>
        <Select
          value={channel === null ? 'custom' : 'channel:' + channel}
          onValueChange={(value) => selectChannel(value === 'custom' ? null : value.slice(8))}
        >
          <SelectTrigger aria-label={t('configPage.json.aliasChannel')} className="sm:w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channels.map((key) => (
              <SelectItem key={key} value={'channel:' + key}>
                {key}
              </SelectItem>
            ))}
            <SelectItem value="custom">{t('configPage.json.customChannel')}</SelectItem>
          </SelectContent>
        </Select>
        {channel === null && (
          <Input
            value={custom}
            disabled={disabled}
            aria-label={t('configPage.json.columns.channel')}
            placeholder={t('configPage.json.placeholders.channel')}
            onChange={(event) => setCustom(event.target.value)}
          />
        )}
        <Button
          type="button"
          variant="outline"
          disabled={!writable}
          onClick={() => {
            if (!rows) return
            onChange({ ...value, [selected]: [...rows, { name: '', alias: '' }] })
            selectChannel(selected)
          }}
        >
          <Plus />
          {t('configPage.json.addAlias')}
        </Button>
      </div>

      {rows === null ? (
        <ReadOnlyAlias value={stored} />
      ) : !rows.length ? (
        <p className="text-muted-foreground text-sm">{t('configPage.json.emptyRows')}</p>
      ) : (
        <div className="divide-y rounded-md border">
          {rows.map((raw, index) => {
            if (!canEditAliasRule(raw, selected))
              return (
                <div className="p-3" key={index}>
                  <ReadOnlyAlias value={raw} />
                </div>
              )
            const row = normalizeModelAliasRule(raw)
            const change = (patch: ModelAliasRule) => updateRow(index, raw, patch)
            return (
              <div key={selected + '/' + index} className="grid gap-3 p-3">
                <div className={formGridClassName}>
                  {(['name', 'alias', 'displayName'] as const).map((field) => (
                    <label
                      key={field}
                      className={fieldClassName}
                      title={t('configPage.json.columnDescriptions.' + field)}
                    >
                      <span>{t('configPage.json.columns.' + field)}</span>
                      <Input
                        value={row[field] ?? ''}
                        disabled={!writable}
                        placeholder={t('configPage.json.placeholders.' + field)}
                        onChange={(event) => change({ [field]: event.target.value })}
                      />
                    </label>
                  ))}
                  {selected === 'vertex' && (
                    <label className={fieldClassName}>
                      <span>{t('configPage.json.vertexProtocol')}</span>
                      <Select
                        disabled={!writable}
                        value={row.openapi == null ? 'auto' : row.openapi ? 'openapi' : 'native'}
                        onValueChange={(mode) =>
                          change({ openapi: mode === 'auto' ? null : mode === 'openapi' })
                        }
                      >
                        <SelectTrigger aria-label={t('configPage.json.vertexProtocol')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['auto', 'native', 'openapi'] as const).map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {t('configPage.json.vertexModes.' + mode)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {(['fork', 'forceMapping'] as const).map((field) => (
                    <label
                      key={field}
                      className="flex items-center gap-2 text-sm"
                      title={t('configPage.json.columnDescriptions.' + field)}
                    >
                      <Checkbox
                        checked={Boolean(row[field])}
                        disabled={!writable}
                        onCheckedChange={(checked) => change({ [field]: checked === true })}
                      />
                      <span>{t('configPage.json.columns.' + field)}</span>
                    </label>
                  ))}
                  <Popover
                    open={move?.index === index}
                    onOpenChange={(open) => setMove(open ? { index, destination: '' } : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button type="button" variant="text" disabled={!writable}>
                        <ArrowRightLeft />
                        {t('configPage.json.moveAlias')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="grid gap-3">
                      <label className={fieldClassName}>
                        <span>{t('configPage.json.columns.channel')}</span>
                        <Input
                          list={listId}
                          value={move?.destination ?? ''}
                          onChange={(event) => setMove({ index, destination: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              moveRow()
                            }
                          }}
                        />
                      </label>
                      <Button type="button" disabled={!canMove} onClick={moveRow}>
                        {t('configPage.json.moveAlias')}
                      </Button>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="destructiveText"
                    disabled={!writable}
                    onClick={() => {
                      setMove(null)
                      onChange(withoutRow(index))
                    }}
                  >
                    <Trash2 />
                    {t('configPage.json.remove')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <datalist id={listId}>
        {channels
          .filter((key) => key !== selected)
          .map((key) => (
            <option key={key} value={key} />
          ))}
      </datalist>
    </div>
  )
}
