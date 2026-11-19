import { useId, useState } from 'react'

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
          onClick={() => rows && updateRows([...rows, { name: '' }])}
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
            const change = (patch: Parameters<typeof editModelSetting>[1]) =>
              updateRows(
                rows.map((entry, i) => (i === index ? editModelSetting(row, patch) : entry)),
              )
            const limit = row['max-context-length']
            const invalidLimit = !validContextLength(limit)
            const errorId = id + '-limit-' + index
            return (
              <div key={index} className="grid gap-2 p-3">
                <div className={formGridClassName}>
                  <label className={fieldClassName}>
                    <span>{t('configPage.modelSettings.name')}</span>
                    <Input
                      value={row.name ?? ''}
                      required
                      aria-invalid={!row.name?.trim()}
                      disabled={!writable}
                      onChange={(event) => change({ name: event.target.value })}
                    />
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
                      placeholder={t('configPage.modelSettings.defaultLimit')}
                      disabled={!writable}
                      aria-invalid={invalidLimit}
                      aria-describedby={invalidLimit ? errorId : undefined}
                      onChange={(event) => change({ contextLength: event.target.value })}
                    />
                    {invalidLimit && (
                      <span id={errorId} className="text-destructive text-xs">
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
                  onClick={() => updateRows(rows.filter((_, i) => i !== index))}
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
