import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Switch } from '@/components/ui/switch'
import {
  type CredentialMetadataPatch,
  type CredentialResource,
  supportsCredentialWebsockets,
} from '@/lib/api/management/credentials'

export type InlineMetadataSave = (
  resource: CredentialResource,
  patch: CredentialMetadataPatch,
) => Promise<void>

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function WebsocketsCell({
  resource,
  mutating,
  onSave,
}: {
  resource: CredentialResource
  mutating: boolean
  onSave: InlineMetadataSave
}) {
  const { t } = useTranslation()

  if (!supportsCredentialWebsockets(resource)) {
    return (
      <span
        className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-md border px-2 py-1 text-xs"
        title={t('credentialsPage.inline.websocketsUnsupported')}
      >
        {t('credentialsPage.inline.notApplicable')}
      </span>
    )
  }

  if (!resource.metadataAvailability.websockets) {
    return (
      <span className="text-muted-foreground text-xs">
        {t('credentialsPage.status.notAvailable')}
      </span>
    )
  }

  const handleToggle = async (checked: boolean) => {
    try {
      await onSave(resource, { websockets: checked })
      toast.success(t('credentialsPage.inline.saved'))
    } catch (error) {
      toast.error(readErrorMessage(error))
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={resource.websockets}
        disabled={mutating}
        aria-label={t('credentialsPage.inline.websocketsLabel')}
        onCheckedChange={(checked) => void handleToggle(checked)}
        onClick={(event) => event.stopPropagation()}
      />
      <span className="text-muted-foreground text-xs">
        {resource.websockets
          ? t('credentialsPage.status.enabled')
          : t('credentialsPage.status.disabled')}
      </span>
    </div>
  )
}

export function CoolingCell({
  resource,
  mutating,
  onSave,
}: {
  resource: CredentialResource
  mutating: boolean
  onSave: InlineMetadataSave
}) {
  const { t } = useTranslation()

  const handleToggle = async (checked: boolean) => {
    try {
      await onSave(resource, { disableCooling: !checked })
      toast.success(t('credentialsPage.inline.saved'))
    } catch (error) {
      toast.error(readErrorMessage(error))
    }
  }

  // Cooling schedule is universal (no metadataAvailability gate). The switch
  // represents whether the credential participates in cooldown scheduling:
  // on = cooling enabled (disableCooling: false), off = cooling disabled (disableCooling: true).
  return (
    <Switch
      checked={!resource.disableCooling}
      disabled={mutating}
      aria-label={t('credentialsPage.form.coolingSchedule')}
      title={t('credentialsPage.form.coolingScheduleHint')}
      onCheckedChange={(checked) => void handleToggle(checked)}
      onClick={(event) => event.stopPropagation()}
    />
  )
}
