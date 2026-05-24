import { useEffect, useState } from 'react'

import { Loader2, PlugZap, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  connectManagementSession,
  disconnectManagementSession,
} from '@/features/session/connect-session'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

type ConnectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectionDialog({ open, onOpenChange }: ConnectionDialogProps) {
  const { t } = useTranslation()
  const baseUrl = useSessionStore((state) => state.baseUrl)
  const managementKey = useSessionStore((state) => state.managementKey)
  const rememberConnection = useSessionStore((state) => state.rememberConnection)
  const detectedBaseUrl = useSessionStore((state) => state.detectedBaseUrl)
  const detectedSource = useSessionStore((state) => state.detectedSource)
  const status = useSessionStore((state) => state.status)
  const error = useSessionStore((state) => state.error)
  const runtimeMode = useCapabilityStore((state) => state.runtimeMode)

  const [draftBaseUrl, setDraftBaseUrl] = useState(baseUrl)
  const [draftManagementKey, setDraftManagementKey] = useState(managementKey)
  const [draftRememberConnection, setDraftRememberConnection] = useState(rememberConnection)
  const [localError, setLocalError] = useState<string | null>(null)

  const connected = status === 'connected'
  const checking = status === 'checking'
  const detectedEndpoint = detectedSource === 'same-origin' ? '/v0/management' : detectedBaseUrl
  const detectedEndpointLabel =
    detectedSource === 'same-origin'
      ? 'connectionDialog.detectedProxyEndpoint'
      : 'connectionDialog.detectedRuntime'

  useEffect(() => {
    if (!open) return

    setDraftBaseUrl(baseUrl)
    setDraftManagementKey(managementKey)
    setDraftRememberConnection(rememberConnection)
    setLocalError(null)
  }, [baseUrl, managementKey, open, rememberConnection])

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draftManagementKey.trim()) {
      setLocalError(t('connectionDialog.errors.managementKeyRequired'))
      return
    }

    try {
      setLocalError(null)
      await connectManagementSession({
        baseUrl: draftBaseUrl,
        managementKey: draftManagementKey.trim(),
        rememberConnection: draftRememberConnection,
      })
      onOpenChange(false)
    } catch {
      // The session store already owns the normalized error state.
    }
  }

  const handleDisconnect = () => {
    disconnectManagementSession()
    onOpenChange(false)
  }

  return (
    <div className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <form
        className="bg-popover text-popover-foreground grid w-full max-w-lg gap-5 rounded-lg border p-5 shadow-xl"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
              <PlugZap className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t('connectionDialog.title')}</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {t('connectionDialog.description')}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('connectionDialog.close')}
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('connectionDialog.baseUrl')}</span>
            <Input
              value={draftBaseUrl}
              onChange={(event) => setDraftBaseUrl(event.target.value)}
              placeholder="http://127.0.0.1:8317"
              disabled={checking}
              autoComplete="url"
            />
            <span className="text-muted-foreground text-xs leading-5">
              {t('connectionDialog.baseUrlHint')}
            </span>
            {detectedBaseUrl ? (
              <span className="text-primary text-xs leading-5">
                {t(detectedEndpointLabel, {
                  endpoint: detectedEndpoint,
                })}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span>{t('connectionDialog.managementKey')}</span>
            <Input
              type="password"
              value={draftManagementKey}
              onChange={(event) => setDraftManagementKey(event.target.value)}
              placeholder={t('connectionDialog.managementKeyPlaceholder')}
              disabled={checking}
              autoComplete="current-password"
            />
          </label>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              className="mt-1"
              checked={draftRememberConnection}
              disabled={checking}
              onCheckedChange={(checked) => setDraftRememberConnection(checked === true)}
            />
            <span className="grid gap-1">
              <span className="font-medium">{t('connectionDialog.remember')}</span>
              <span className="text-muted-foreground text-xs leading-5">
                {t('connectionDialog.rememberHint')}
              </span>
            </span>
          </label>
        </div>

        {connected ? (
          <div className="bg-accent text-accent-foreground rounded-md border px-3 py-2 text-sm">
            {t('connectionDialog.connectedAs', {
              mode: t(`runtimeMode.${runtimeMode}`),
            })}
          </div>
        ) : null}

        {localError || error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {localError ?? error?.message}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {connected ? (
            <Button type="button" variant="outline" onClick={handleDisconnect} disabled={checking}>
              {t('connectionDialog.disconnect')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('connectionDialog.cancel')}
            </Button>
            <Button type="submit" disabled={checking}>
              {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {checking ? t('connectionDialog.connecting') : t('connectionDialog.connect')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
