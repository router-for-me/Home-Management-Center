import { AlertTriangle, CircleHelp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getCredentialDisplayName } from '@/features/credentials/credential-display'
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

export function CredentialEnabledCell({
  resource,
  mutating,
  onToggleStatus,
  onInspect,
}: {
  resource: CredentialResource
  mutating: boolean
  onToggleStatus: (resource: CredentialResource, disabled: boolean) => void
  onInspect: () => void
}) {
  const { t } = useTranslation()
  const hasException = !resource.disabled && (resource.unavailable || resource.status !== 'active')
  const statusLabel = resource.unavailable
    ? t('credentialsPage.status.unavailable')
    : t(`credentialsPage.status.${resource.status}`, { defaultValue: resource.status })
  const StatusIcon =
    resource.unavailable || resource.status === 'error' ? AlertTriangle : CircleHelp

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Switch
        checked={!resource.disabled}
        disabled={mutating}
        aria-label={t('credentialsPage.list.toggleStatus', {
          name: getCredentialDisplayName(resource),
        })}
        onCheckedChange={(checked) => onToggleStatus(resource, !checked)}
        onClick={(event) => event.stopPropagation()}
      />
      {hasException ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="text"
              size="icon-xs"
              className="cursor-pointer"
              aria-label={statusLabel}
              aria-haspopup="dialog"
              onClick={(event) => {
                event.stopPropagation()
                onInspect()
              }}
            >
              <StatusIcon
                className={
                  resource.unavailable
                    ? 'text-warning-foreground dark:text-warning'
                    : resource.status === 'error'
                      ? 'text-destructive'
                      : undefined
                }
                aria-hidden="true"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-[min(24rem,calc(100vw-2rem))] wrap-anywhere whitespace-normal"
          >
            {statusLabel}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
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

  const supported = supportsCredentialWebsockets(resource)

  if (!supported || !resource.metadataAvailability.websockets) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground text-body cursor-pointer" tabIndex={0}>
            {supported
              ? t('credentialsPage.inline.websocketsUnknown')
              : t('credentialsPage.inline.notApplicable')}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[min(24rem,calc(100vw-2rem))] whitespace-normal">
          {supported
            ? t('credentialsPage.inline.websocketsMissing')
            : t('credentialsPage.inline.websocketsUnsupported')}
        </TooltipContent>
      </Tooltip>
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
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Switch
        checked={resource.websockets}
        disabled={mutating}
        aria-label={t('credentialsPage.inline.websocketsLabel', {
          name: getCredentialDisplayName(resource),
        })}
        onCheckedChange={(checked) => void handleToggle(checked)}
        onClick={(event) => event.stopPropagation()}
      />
      <span
        className="text-muted-foreground text-meta max-w-full truncate"
        title={
          resource.websockets
            ? t('credentialsPage.inline.websocketsEnabled')
            : t('credentialsPage.inline.websocketsDisabled')
        }
      >
        {resource.websockets
          ? t('credentialsPage.inline.websocketsEnabled')
          : t('credentialsPage.inline.websocketsDisabled')}
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
