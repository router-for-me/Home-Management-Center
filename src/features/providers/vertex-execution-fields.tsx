import { useTranslation } from 'react-i18next'

import { fieldClassName, formGridClassName } from '@/components/shared/form-layout'
import { OptionalBooleanField } from '@/components/shared/optional-boolean-field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { VertexExecutionOptions } from '@/lib/api/management/providers'

export function VertexExecutionFields({
  group,
  keyOptions,
  count,
  disabled,
  onGroupChange,
  onKeyChange,
}: {
  group: VertexExecutionOptions
  keyOptions?: VertexExecutionOptions
  count: number
  disabled: boolean
  onGroupChange: (value: VertexExecutionOptions) => void
  onKeyChange: (value: VertexExecutionOptions) => void
}) {
  const { t } = useTranslation()
  const automatic = t('configPage.json.vertexModes.auto')
  const native = t('configPage.json.vertexModes.native')
  const openapi = t('configPage.json.vertexModes.openapi')
  const nativeInteractions = t('providersPage.vertex.nativeInteractions')
  const bridge = t('providersPage.vertex.bridge')
  const inherit = (value: string) => t('providersPage.vertex.inherit', { value })

  function fields(
    value: VertexExecutionOptions,
    change: (next: VertexExecutionOptions) => void,
    key: boolean,
  ) {
    const protocol = group.openapi == null ? automatic : group.openapi ? openapi : native
    return (
      <div className={formGridClassName}>
        <OptionalBooleanField
          label={t('providersPage.vertex.credentialProtocol')}
          value={value.openapi}
          defaultLabel={key ? inherit(protocol) : automatic}
          offLabel={native}
          onLabel={openapi}
          description={t('providersPage.vertex.protocolHint')}
          disabled={disabled}
          onChange={(openapi) => change({ ...value, openapi })}
        />
        <label className={fieldClassName}>
          <span>{t('providersPage.vertex.location')}</span>
          <Input
            className="font-mono"
            value={value.location}
            disabled={disabled}
            placeholder={key ? inherit(group.location || automatic) : automatic}
            onChange={(event) => change({ ...value, location: event.target.value })}
          />
        </label>
        <OptionalBooleanField
          label={t('providersPage.vertex.interactions')}
          value={value.interactions}
          defaultLabel={
            key
              ? inherit(group.interactions ? nativeInteractions : bridge)
              : t('providersPage.vertex.cpaDefault')
          }
          offLabel={bridge}
          onLabel={nativeInteractions}
          disabled={disabled}
          onChange={(interactions) => change({ ...value, interactions })}
        />
      </div>
    )
  }

  return (
    <fieldset className="min-w-0 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{t('providersPage.vertex.title')}</legend>
      {keyOptions ? (
        <Tabs defaultValue="key">
          <TabsList aria-label={t('providersPage.vertex.title')}>
            <TabsTrigger value="key">{t('providersPage.vertex.key')}</TabsTrigger>
            <TabsTrigger value="group">{t('providersPage.vertex.group')}</TabsTrigger>
          </TabsList>
          <TabsContent value="key" className="pt-3">
            {fields(keyOptions, onKeyChange, true)}
          </TabsContent>
          <TabsContent value="group" className="grid gap-3 pt-3">
            <p className="text-muted-foreground text-xs">
              {t('providersPage.vertex.groupHint', { count })}
            </p>
            {fields(group, onGroupChange, false)}
          </TabsContent>
        </Tabs>
      ) : (
        fields(group, onGroupChange, false)
      )}
    </fieldset>
  )
}
