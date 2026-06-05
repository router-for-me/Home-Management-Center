import { useEffect, useState } from 'react'

import { Link, useNavigate } from '@tanstack/react-router'

import { ArrowLeft, CheckCircle2, KeyRound, Loader2, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  connectManagementSession,
  disconnectManagementSession,
} from '@/features/session/connect-session'
import { useCapabilityStore } from '@/stores/capability-store'
import { useSessionStore } from '@/stores/session-store'

export function AdminConnectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
  const checking = status === 'checking'
  const connected = status === 'connected'
  const detectedEndpoint = detectedSource === 'same-origin' ? '/v0/management' : detectedBaseUrl
  const detectedEndpointLabel =
    detectedSource === 'same-origin'
      ? 'connectionDialog.detectedProxyEndpoint'
      : 'connectionDialog.detectedRuntime'

  useEffect(() => {
    setDraftBaseUrl(baseUrl)
    setDraftManagementKey(managementKey)
    setDraftRememberConnection(rememberConnection)
  }, [baseUrl, managementKey, rememberConnection])

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
      await navigate({ to: '/admin/dashboard' })
    } catch {
      // The management session store owns the normalized runtime error.
    }
  }

  const handleDisconnect = () => {
    disconnectManagementSession()
    setDraftManagementKey('')
  }

  return (
    <PublicAccessShell>
      <section className="mx-auto grid max-w-2xl gap-6">
        <Button asChild variant="text" size="sm" className="w-fit px-0">
          <Link to="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('adminAccess.back')}
          </Link>
        </Button>

        <div className="bg-card rounded-lg border shadow-sm">
          <div className="border-b p-5 md:p-6">
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-md">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">{t('adminAccess.title')}</h1>
            <p className="text-muted-foreground mt-2 max-w-[65ch] text-sm leading-6">
              {t('adminAccess.description')}
            </p>
          </div>

          <form className="grid gap-5 p-5 md:p-6" onSubmit={(event) => void handleSubmit(event)}>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t('connectionDialog.baseUrl')}</span>
              <Input
                value={draftBaseUrl}
                onChange={(event) => setDraftBaseUrl(event.target.value)}
                placeholder="http://127.0.0.1:8327"
                disabled={checking}
                autoComplete="url"
              />
              <span className="text-muted-foreground text-xs leading-5">
                {t('connectionDialog.baseUrlHint')}
              </span>
              {detectedBaseUrl ? (
                <span className="text-primary text-xs leading-5">
                  {t(detectedEndpointLabel, { endpoint: detectedEndpoint })}
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

            {connected ? (
              <div className="border-success/30 bg-success/10 text-success-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t('connectionDialog.connectedAs', { mode: t(`runtimeMode.${runtimeMode}`) })}
              </div>
            ) : null}

            {localError || error ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                {localError ?? error?.message}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
              {connected ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={checking}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  {t('connectionDialog.disconnect')}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={checking}>
                {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {checking
                  ? t('connectionDialog.connecting')
                  : connected
                    ? t('connectionDialog.update')
                    : t('connectionDialog.connect')}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </PublicAccessShell>
  )
}
