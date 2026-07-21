import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  type CredentialMetadataInput,
  type CredentialResource,
  supportsCredentialWebsockets,
} from '@/lib/api/management/credentials'

export type InlineMetadataSave = (
  resource: CredentialResource,
  patch: Partial<CredentialMetadataInput>,
) => Promise<void>

export function isValidPriorityDraft(value: string) {
  return /^-?\d+$/.test(value.trim())
}

export function buildInlineMetadataInput(
  resource: CredentialResource,
  patch: Partial<CredentialMetadataInput>,
): CredentialMetadataInput {
  return {
    prefix: resource.prefix ?? '',
    proxyUrl: resource.proxyUrl ?? '',
    priority: resource.priority === null ? '' : String(resource.priority),
    note: resource.note ?? '',
    websockets: resource.websockets,
    ...patch,
  }
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function ProxyUrlCell({
  resource,
  mutating,
  onSave,
}: {
  resource: CredentialResource
  mutating: boolean
  onSave: InlineMetadataSave
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(resource.proxyUrl ?? '')

  useEffect(() => {
    setValue(resource.proxyUrl ?? '')
  }, [resource.proxyUrl])

  const handleSave = async () => {
    const next = value.trim()
    if (next === (resource.proxyUrl ?? '')) return

    try {
      await onSave(resource, { proxyUrl: next })
      toast.success(t('credentialsPage.inline.saved'))
    } catch (error) {
      setValue(resource.proxyUrl ?? '')
      toast.error(readErrorMessage(error))
    }
  }

  return (
    <Input
      value={value}
      disabled={mutating}
      placeholder="socks5://host:port"
      aria-label={t('credentialsPage.inline.proxyUrlLabel')}
      className="h-8 min-w-44 font-mono text-xs"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void handleSave()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          setValue(resource.proxyUrl ?? '')
        }
      }}
    />
  )
}

export function PriorityCell({
  resource,
  mutating,
  onSave,
}: {
  resource: CredentialResource
  mutating: boolean
  onSave: InlineMetadataSave
}) {
  const { t } = useTranslation()
  const currentPriority = resource.priority === null ? '' : String(resource.priority)
  const [value, setValue] = useState(currentPriority)

  useEffect(() => {
    setValue(currentPriority)
  }, [currentPriority])

  const handleSave = async () => {
    const next = value.trim()
    if (next === currentPriority) return

    if (!isValidPriorityDraft(next)) {
      setValue(currentPriority)
      toast.error(t('credentialsPage.inline.priorityInvalid'))
      return
    }

    try {
      await onSave(resource, { priority: next })
      toast.success(t('credentialsPage.inline.saved'))
    } catch (error) {
      setValue(currentPriority)
      toast.error(readErrorMessage(error))
    }
  }

  return (
    <Input
      value={value}
      disabled={mutating}
      inputMode="numeric"
      aria-label={t('credentialsPage.inline.priorityLabel')}
      className="h-8 w-20 text-center font-mono text-xs"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void handleSave()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          setValue(currentPriority)
        }
      }}
    />
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
