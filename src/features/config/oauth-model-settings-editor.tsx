import {
  type Dispatch,
  type SetStateAction,
  createContext,
  useContext,
  useId,
  useRef,
  useState,
} from 'react'

import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  fieldClassName,
  filterActionsClassName,
  formGridClassName,
} from '@/components/shared/form-layout'
import { OptionalBooleanField } from '@/components/shared/optional-boolean-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isOAuthChannelKey, oauthChannelValue } from '@/lib/api/management/oauth-model-channels'
import {
  canEditModelSetting,
  editModelSetting,
  oauthSettingChannels,
  validContextLength,
} from '@/lib/api/management/oauth-model-settings'

export type ModelSettingIssue = { provider: string; index: number; field: 'name' | 'limit' }
export const ModelSettingFeedbackContext = createContext<
  [ModelSettingIssue[], Dispatch<SetStateAction<ModelSettingIssue[]>>]
>([[], () => {}])

function ReadOnlySetting({ value }: { value: unknown }) {
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

export function OAuthModelSettingsEditor({
  value,
  disabled,
  onChange,
}: {
  value: Record<string, unknown>
  disabled: boolean
  onChange: (value: Record<string, unknown>) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [issues, setIssues] = useContext(ModelSettingFeedbackContext)
  const focusNewName = useRef<number | null>(null)
  const [provider, setProvider] = useState(
    () => Object.keys(value).find(isOAuthChannelKey) ?? 'codex',
  )
  const channels = [...new Set([...Object.keys(value), ...oauthSettingChannels, provider])].filter(
    Boolean,
  )
  const stored = oauthChannelValue(value, provider)
  const rows: unknown[] | null = stored == null ? [] : Array.isArray(stored) ? stored : null
  const writable = !disabled && rows !== null && isOAuthChannelKey(provider)
  function updateRows(nextRows: unknown[]) {
    const next = { ...value }
    if (nextRows.length) next[provider] = nextRows
    else delete next[provider]
    onChange(next)
  }

  function reveal(index: number, field: ModelSettingIssue['field']) {
    setIssues((current) =>
      current.some(
        (issue) => issue.provider === provider && issue.index === index && issue.field === field,
      )
        ? current
        : [...current, { provider, index, field }],
    )
  }

  function removeRow(index: number) {
    if (!rows) return
    setIssues((current) =>
      current
        .filter((issue) => issue.provider !== provider || issue.index !== index)
        .map((issue) =>
          issue.provider === provider && issue.index > index
            ? { ...issue, index: issue.index - 1 }
            : issue,
        ),
    )
    updateRows(rows.filter((_, i) => i !== index))
  }

  return (
    <div className="grid gap-3">
      <div className={filterActionsClassName}>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="sm:w-fit" aria-label={t('configPage.modelSettings.provider')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={!writable}
          onClick={() => {
            if (!rows) return
            focusNewName.current = rows.length
            updateRows([...rows, { name: '' }])
          }}
        >
          <Plus />
          {t('configPage.modelSettings.add')}
        </Button>
      </div>
      {rows === null ? (
        <ReadOnlySetting value={stored} />
      ) : !rows.length ? (
        <p className="text-muted-foreground text-sm">
          {t('configPage.modelSettings.empty', { provider })}
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {rows.map((row, index) => {
            if (!canEditModelSetting(row, provider))
              return (
                <div className="p-3" key={index}>
                  <ReadOnlySetting value={row} />
                </div>
              )
            const rowIssues = issues.filter(
              (issue) => issue.provider === provider && issue.index === index,
            )
            const nameIssue = rowIssues.find((issue) => issue.field === 'name')
            const limitIssue = rowIssues.find((issue) => issue.field === 'limit')
            const change = (patch: Parameters<typeof editModelSetting>[1]) => {
              const next = editModelSetting(row, patch)
              if (nameIssue && next.name?.trim())
                setIssues((current) => current.filter((issue) => issue !== nameIssue))
              if (limitIssue && validContextLength(next['max-context-length']))
                setIssues((current) => current.filter((issue) => issue !== limitIssue))
              updateRows(rows.map((entry, i) => (i === index ? next : entry)))
            }
            const limit = row['max-context-length']
            const invalidName = !row.name?.trim()
            const invalidLimit = !validContextLength(limit)
            const showNameError = invalidName && Boolean(nameIssue)
            const showLimitError = invalidLimit && Boolean(limitIssue)
            const nameErrorId = id + '-name-' + index
            const limitErrorId = id + '-limit-' + index
            return (
              <div key={index} className="grid gap-2 p-3">
                <div className={formGridClassName}>
                  <label className={fieldClassName}>
                    <span>{t('configPage.modelSettings.name')}</span>
                    <Input
                      ref={(input) => {
                        if (input && focusNewName.current === index) {
                          focusNewName.current = null
                          input.focus()
                        }
                      }}
                      value={row.name ?? ''}
                      required
                      aria-label={t('configPage.modelSettings.name')}
                      aria-invalid={showNameError}
                      aria-describedby={showNameError ? nameErrorId : undefined}
                      disabled={!writable}
                      onBlur={() => invalidName && reveal(index, 'name')}
                      onChange={(event) => change({ name: event.target.value })}
                    />
                    {showNameError && (
                      <span id={nameErrorId} className="text-destructive text-xs" role="alert">
                        {t('configPage.modelSettings.nameRequired')}
                      </span>
                    )}
                  </label>
                  <label className={fieldClassName}>
                    <span>{t('configPage.modelSettings.alias')}</span>
                    <Input
                      value={row.alias ?? ''}
                      disabled={!writable}
                      onChange={(event) => change({ alias: event.target.value })}
                    />
                  </label>
                  <label className={fieldClassName}>
                    <span>{t('configPage.modelSettings.limit')}</span>
                    <Input
                      value={limit ?? ''}
                      inputMode="numeric"
                      aria-label={t('configPage.modelSettings.limit')}
                      placeholder={t('configPage.modelSettings.defaultLimit')}
                      disabled={!writable}
                      aria-invalid={showLimitError}
                      aria-describedby={showLimitError ? limitErrorId : undefined}
                      onBlur={() => invalidLimit && reveal(index, 'limit')}
                      onChange={(event) => change({ contextLength: event.target.value })}
                    />
                    {showLimitError && (
                      <span id={limitErrorId} className="text-destructive text-xs" role="alert">
                        {t('configPage.modelSettings.invalidLimit')}
                      </span>
                    )}
                  </label>
                  {provider.toLowerCase() === 'vertex' && (
                    <OptionalBooleanField
                      label={t('configPage.json.vertexProtocol')}
                      value={typeof row.openapi === 'boolean' ? row.openapi : null}
                      defaultLabel={t('configPage.json.vertexModes.auto')}
                      offLabel={t('configPage.json.vertexModes.native')}
                      onLabel={t('configPage.json.vertexModes.openapi')}
                      disabled={!writable}
                      onChange={(openapi) => change({ openapi })}
                    />
                  )}
                </div>
                <Button
                  type="button"
                  variant="destructiveText"
                  className="justify-self-end"
                  disabled={!writable}
                  aria-label={t('configPage.modelSettings.removeRow', {
                    model: row.alias || row.name || index + 1,
                  })}
                  onClick={() => removeRow(index)}
                >
                  <Trash2 />
                  {t('configPage.json.remove')}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
