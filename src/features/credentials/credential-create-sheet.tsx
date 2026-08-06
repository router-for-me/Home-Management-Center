import { useEffect, useRef, useState } from 'react'

import {
  CircleCheck,
  CircleX,
  ClipboardCheck,
  CloudUpload,
  Copy,
  ExternalLink,
  FileJson,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ProviderLogo } from '@/components/shared/provider-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatCredentialBytes } from '@/features/credentials/credential-display'
import {
  type CredentialOAuthCallbackInput,
  type CredentialOAuthCallbackProvider,
  type CredentialOAuthProvider,
  type CredentialOAuthStatus,
  type VertexImportResult,
} from '@/lib/api/management/credentials'
import { cn } from '@/lib/utils'

import { type CredentialUploadItem, isCredentialUploadRetryable } from './credential-upload'

export type CreateCredentialMode = 'oauth' | 'upload' | 'vertex'

export type OAuthSessionSummary = {
  provider: CredentialOAuthProvider
  state: string | null
  url: string
}
export type OAuthSessionMap = Partial<Record<CredentialOAuthProvider, OAuthSessionSummary>>
export type OAuthStatusMap = Partial<Record<CredentialOAuthProvider, CredentialOAuthStatus>>

const oauthStatusToneClassNames: Record<string, string> = {
  ok: 'border-primary/30 bg-primary/10 text-primary',
  wait: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  unknown: 'border-border bg-muted text-muted-foreground',
}

function isOAuthCallbackProvider(
  provider: CredentialOAuthProvider,
): provider is CredentialOAuthCallbackProvider {
  return provider !== 'kimi'
}

function isXaiOAuthProvider(provider: CredentialOAuthProvider): provider is 'xai' {
  return provider === 'xai'
}

function createOAuthCallbackForm(
  provider: CredentialOAuthCallbackProvider,
  state: string | null,
): CredentialOAuthCallbackInput {
  return {
    provider,
    redirectUrl: '',
    code: '',
    state: state ?? '',
    error: '',
  }
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.append(textArea)
  textArea.select()
  document.execCommand('copy')
  textArea.remove()
}

function OAuthClosurePanel({
  session,
  status,
  mutating,
  compact = false,
  onCheckStatus,
  onSubmitCallback,
}: {
  session: OAuthSessionSummary
  status: CredentialOAuthStatus | null
  mutating: boolean
  compact?: boolean
  onCheckStatus: (state: string) => Promise<void>
  onSubmitCallback: (input: CredentialOAuthCallbackInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const callbackSupported = isOAuthCallbackProvider(session.provider)
  const [statusState, setStatusState] = useState(session.state ?? '')
  const [callbackForm, setCallbackForm] = useState<CredentialOAuthCallbackInput | null>(() => {
    if (!isOAuthCallbackProvider(session.provider)) return null

    return createOAuthCallbackForm(session.provider, session.state)
  })
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setStatusState(session.state ?? '')
    setCallbackForm(
      isOAuthCallbackProvider(session.provider)
        ? createOAuthCallbackForm(session.provider, session.state)
        : null,
    )
    setLocalError(null)
  }, [session])

  const handleCheckStatus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setLocalError(null)
      await onCheckStatus(statusState)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleSubmitCallback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!callbackForm) return

    const isXaiCallback = isXaiOAuthProvider(callbackForm.provider)

    if (
      isXaiCallback &&
      !callbackForm.state.trim() &&
      !/(^|[?&#])state=/i.test(callbackForm.redirectUrl)
    ) {
      setLocalError(t('credentialsPage.oauth.validation.xaiStateRequired'))
      return
    }

    if (!callbackForm.state.trim() && !callbackForm.redirectUrl.trim()) {
      setLocalError(t('credentialsPage.oauth.validation.stateRequired'))
      return
    }

    if (
      !callbackForm.code.trim() &&
      !callbackForm.error.trim() &&
      !callbackForm.redirectUrl.trim()
    ) {
      setLocalError(t('credentialsPage.oauth.validation.callbackPayloadRequired'))
      return
    }

    try {
      setLocalError(null)
      await onSubmitCallback(callbackForm)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  const normalizedStatus = status?.status?.trim().toLowerCase() || 'unknown'

  return (
    <section
      className={cn('rounded-lg border', compact ? 'bg-muted/20 p-4' : 'bg-card p-5 shadow-sm')}
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
          <ClipboardCheck className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('credentialsPage.oauth.closureTitle')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('credentialsPage.oauth.closureDescription')}
          </p>
        </div>
      </div>

      <div className="bg-muted/30 mt-4 grid gap-2 rounded-md border p-3 text-xs">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="text-muted-foreground">{t('credentialsPage.oauth.lastProvider')}</span>
          <span className="truncate font-medium">
            {t(`credentialsPage.oauth.providers.${session.provider}`)}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="text-muted-foreground">{t('credentialsPage.oauth.lastState')}</span>
          <span className="truncate font-mono">
            {session.state ?? t('credentialsPage.status.notSet')}
          </span>
        </div>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={(event) => void handleCheckStatus(event)}>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('credentialsPage.oauth.statusState')}</span>
          <Input
            value={statusState}
            placeholder={t('credentialsPage.oauth.statePlaceholder')}
            disabled={mutating}
            onChange={(event) => setStatusState(event.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {status ? (
            <span
              className={cn(
                'inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-xs font-medium',
                oauthStatusToneClassNames[normalizedStatus] ?? oauthStatusToneClassNames.unknown,
              )}
            >
              {t(`credentialsPage.oauth.statuses.${normalizedStatus}`, {
                defaultValue: status.status,
              })}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              {t('credentialsPage.oauth.statusNotChecked')}
            </span>
          )}
          <Button type="submit" variant="outline" size="md" disabled={mutating}>
            {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('credentialsPage.oauth.checkStatus')}
          </Button>
        </div>
        {status?.error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {status.error}
          </div>
        ) : null}
      </form>

      {callbackForm && callbackSupported ? (
        <form
          className="mt-5 grid gap-3 border-t pt-5"
          onSubmit={(event) => void handleSubmitCallback(event)}
        >
          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <label className="grid gap-2 text-sm font-medium">
              <span>{t('credentialsPage.oauth.callbackProvider')}</span>
              <div className="border-input bg-muted/30 flex h-9 items-center rounded-md border px-3 text-sm">
                {t(`credentialsPage.oauth.providers.${callbackForm.provider}`)}
              </div>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t('credentialsPage.oauth.callbackState')}</span>
              <Input
                value={callbackForm.state}
                placeholder={t('credentialsPage.oauth.statePlaceholder')}
                disabled={mutating}
                onChange={(event) =>
                  setCallbackForm((current) =>
                    current ? { ...current, state: event.target.value } : current,
                  )
                }
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            <span>
              {t(
                isXaiOAuthProvider(callbackForm.provider)
                  ? 'credentialsPage.oauth.xaiCallbackInput'
                  : 'credentialsPage.oauth.redirectUrl',
              )}
            </span>
            <Input
              value={callbackForm.redirectUrl}
              placeholder={
                isXaiOAuthProvider(callbackForm.provider)
                  ? t('credentialsPage.oauth.xaiCallbackPlaceholder')
                  : 'http://localhost/callback?code=...&state=...'
              }
              disabled={mutating}
              onChange={(event) =>
                setCallbackForm((current) =>
                  current ? { ...current, redirectUrl: event.target.value } : current,
                )
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              <span>{t('credentialsPage.oauth.authorizationCode')}</span>
              <Input
                value={callbackForm.code}
                disabled={mutating}
                onChange={(event) =>
                  setCallbackForm((current) =>
                    current ? { ...current, code: event.target.value } : current,
                  )
                }
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              <span>{t('credentialsPage.oauth.callbackError')}</span>
              <Input
                value={callbackForm.error}
                disabled={mutating}
                onChange={(event) =>
                  setCallbackForm((current) =>
                    current ? { ...current, error: event.target.value } : current,
                  )
                }
              />
            </label>
          </div>

          {localError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
              {localError}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={mutating}>
              {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {t('credentialsPage.oauth.submitCallback')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-muted-foreground bg-muted/30 mt-5 rounded-md border px-3 py-2 text-xs">
          {t('credentialsPage.oauth.callbackUnsupported')}
        </div>
      )}
    </section>
  )
}

function OAuthAuthorizationLinkPanel({ session }: { session: OAuthSessionSummary }) {
  const { t } = useTranslation()

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(session.url)
      toast.success(t('credentialsPage.toast.oauthLinkCopied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleOpen = () => {
    window.open(session.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="bg-muted/20 mt-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-warning/12 text-warning-foreground dark:text-warning flex size-9 shrink-0 items-center justify-center rounded-md">
          <ExternalLink className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            {t('credentialsPage.oauth.authorizationLinkTitle')}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {t('credentialsPage.oauth.authorizationLinkDescription')}
          </p>
        </div>
      </div>
      <div className="bg-card mt-3 rounded-md border p-3">
        <p className="text-muted-foreground mb-1 text-xs">
          {t('credentialsPage.oauth.authorizationLink')}
        </p>
        <p className="text-foreground max-h-24 overflow-auto font-mono text-xs leading-5 break-all">
          {session.url}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="md" onClick={() => void handleCopy()}>
          <Copy className="size-4" aria-hidden="true" />
          {t('credentialsPage.oauth.copyAuthorizationLink')}
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={handleOpen}>
          <ExternalLink className="size-4" aria-hidden="true" />
          {t('credentialsPage.oauth.openAuthorizationLink')}
        </Button>
      </div>
    </section>
  )
}

function CredentialFileDropzone({
  fileInputRef,
  title,
  description,
  disabled,
  multiple = false,
  selectedFile = null,
  selectedDescription,
  clearSelectionLabel,
  className,
  onFiles,
  onClearSelection,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  title: string
  description: string
  disabled: boolean
  multiple?: boolean
  selectedFile?: File | null
  selectedDescription?: string
  clearSelectionLabel?: string
  className?: string
  onFiles: (fileList: FileList | null) => void | Promise<void>
  onClearSelection?: () => void
}) {
  const [dragActive, setDragActive] = useState(false)

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    if (disabled) return
    void onFiles(event.dataTransfer.files)
  }

  return (
    <div className="grid min-w-0 gap-2">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'min-w-0 cursor-pointer justify-center overflow-hidden rounded-lg border p-5 text-center whitespace-normal',
          selectedFile ? 'bg-muted/20 hover:bg-muted/30 border-solid' : 'border-dashed',
          dragActive
            ? 'border-primary/60 bg-primary/5'
            : 'hover:border-primary/40 hover:bg-primary/5',
          className,
        )}
        disabled={disabled}
        onClick={openFilePicker}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={handleDrop}
      >
        <span className="flex min-w-0 flex-col items-center justify-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
            {selectedFile ? (
              <FileJson className="size-4" aria-hidden="true" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
          </span>
          <span className="grid min-w-0 gap-1.5">
            <span className="block max-w-full truncate text-sm font-semibold">
              {selectedFile?.name ?? title}
            </span>
            <span className="text-muted-foreground block max-w-sm text-xs leading-5">
              {selectedFile && selectedDescription ? selectedDescription : description}
            </span>
          </span>
        </span>
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        multiple={multiple}
        className="hidden"
        aria-label={title}
        onChange={(event) => {
          void onFiles(event.target.files)
          event.currentTarget.value = ''
        }}
      />
      {selectedFile && onClearSelection && clearSelectionLabel ? (
        <Button
          type="button"
          variant="text"
          size="md"
          className="justify-self-end"
          disabled={disabled}
          onClick={onClearSelection}
        >
          <X className="size-4" aria-hidden="true" />
          {clearSelectionLabel}
        </Button>
      ) : null}
    </div>
  )
}

function VertexImportPanel({
  result,
  mutating,
  compact = false,
  onImport,
}: {
  result: VertexImportResult | null
  mutating: boolean
  compact?: boolean
  onImport: (input: { file: File; location: string }) => Promise<void>
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [location, setLocation] = useState('us-central1')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!file) {
      setLocalError(t('credentialsPage.vertex.validation.fileRequired'))
      return
    }

    try {
      setLocalError(null)
      await onImport({ file, location })
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section
      className={cn('rounded-lg border', compact ? 'bg-muted/20 p-4' : 'bg-card p-5 shadow-sm')}
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
          <CloudUpload className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('credentialsPage.vertex.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('credentialsPage.vertex.description')}
          </p>
        </div>
      </div>

      <form
        aria-busy={mutating}
        className="mt-4 grid gap-3"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <fieldset className="min-w-0">
          <legend className="text-sm font-medium">{t('credentialsPage.vertex.file')}</legend>
          <div className="mt-2">
            <CredentialFileDropzone
              fileInputRef={fileInputRef}
              title={t('credentialsPage.vertex.dropzone.title')}
              description={t('credentialsPage.vertex.dropzone.description')}
              disabled={mutating}
              selectedFile={file}
              selectedDescription={
                file
                  ? mutating
                    ? t('credentialsPage.vertex.dropzone.importing')
                    : t('credentialsPage.vertex.dropzone.selected', {
                        size: formatCredentialBytes(file.size),
                      })
                  : undefined
              }
              clearSelectionLabel={t('credentialsPage.vertex.dropzone.remove')}
              className="min-h-32"
              onFiles={(fileList) => {
                setFile(fileList?.[0] ?? null)
                setLocalError(null)
              }}
              onClearSelection={() => {
                setFile(null)
                setLocalError(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            />
          </div>
          {file ? (
            <p role="status" aria-live="polite" className="sr-only">
              {t('credentialsPage.vertex.dropzone.selectedStatus', { name: file.name })}
            </p>
          ) : null}
        </fieldset>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('credentialsPage.vertex.location')}</span>
          <Input
            value={location}
            placeholder="us-central1"
            disabled={mutating}
            onChange={(event) => setLocation(event.target.value)}
          />
          <span className="text-muted-foreground text-xs leading-5 font-normal">
            {t('credentialsPage.vertex.locationHint')}
          </span>
        </label>

        {localError ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {localError}
          </div>
        ) : null}

        <Button type="submit" disabled={mutating}>
          {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('credentialsPage.vertex.import')}
        </Button>
      </form>

      {result ? (
        <dl className="bg-muted/30 mt-4 grid gap-2 rounded-md border p-3 text-xs">
          {[
            ['status', result.status],
            ['projectId', result.projectId ?? t('credentialsPage.status.notAvailable')],
            ['email', result.email ?? t('credentialsPage.status.notAvailable')],
            ['location', result.location ?? t('credentialsPage.status.notAvailable')],
            ['authFile', result.authFile ?? t('credentialsPage.status.notAvailable')],
          ].map(([key, value]) => (
            <div key={key} className="grid gap-1">
              <dt className="text-muted-foreground">{t(`credentialsPage.vertex.fields.${key}`)}</dt>
              <dd className="font-mono break-words">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

function OAuthStartPanel({
  providers,
  sessions,
  statuses,
  mutating,
  onStartOAuth,
  onCheckStatus,
  onSubmitCallback,
}: {
  providers: CredentialOAuthProvider[]
  sessions: OAuthSessionMap
  statuses: OAuthStatusMap
  mutating: boolean
  onStartOAuth: (provider: CredentialOAuthProvider) => Promise<void>
  onCheckStatus: (provider: CredentialOAuthProvider, state: string) => Promise<void>
  onSubmitCallback: (input: CredentialOAuthCallbackInput) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        {providers.map((provider) => {
          const session = sessions[provider]
          const status = statuses[provider] ?? null

          return (
            <div key={provider} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <ProviderLogo providerId={provider} size="sm" />
                      <span className="truncate">
                        {t(`credentialsPage.oauth.providers.${provider}`)}
                      </span>
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t(`credentialsPage.oauth.providerHints.${provider}`)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="md"
                  disabled={mutating}
                  onClick={() => void onStartOAuth(provider)}
                >
                  {mutating ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ExternalLink className="size-4" aria-hidden="true" />
                  )}
                  {t('credentialsPage.oauth.startLogin')}
                </Button>
              </div>

              {session ? (
                <div className="mt-3">
                  <OAuthAuthorizationLinkPanel session={session} />
                  <OAuthClosurePanel
                    compact
                    session={session}
                    status={status}
                    mutating={mutating}
                    onCheckStatus={(state) => onCheckStatus(provider, state)}
                    onSubmitCallback={onSubmitCallback}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function JsonUploadPanel({
  fileInputRef,
  items,
  disabled,
  uploading,
  onUpload,
  onRetry,
  onRetryFailed,
  onRemove,
  onClear,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  items: CredentialUploadItem[]
  disabled: boolean
  uploading: boolean
  onUpload: (fileList: FileList | null) => Promise<void>
  onRetry: (item: CredentialUploadItem) => Promise<void>
  onRetryFailed: () => Promise<void>
  onRemove: (itemId: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const completedCount = items.filter(
    (item) => item.status === 'success' || item.status === 'error',
  ).length
  const successCount = items.filter((item) => item.status === 'success').length
  const failedItems = items.filter((item) => item.status === 'error')
  const retryableItems = failedItems.filter((item) => isCredentialUploadRetryable(item.errorCode))

  return (
    <div className="grid min-w-0 content-start gap-3">
      <CredentialFileDropzone
        fileInputRef={fileInputRef}
        title={t('credentialsPage.upload.title')}
        description={t('credentialsPage.upload.description')}
        disabled={disabled}
        multiple
        className="min-h-36"
        onFiles={onUpload}
      />
      {items.length > 0 ? (
        <section aria-busy={uploading} className="grid gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t('credentialsPage.upload.resultsTitle')}</p>
              <p role="status" aria-live="polite" className="text-muted-foreground mt-0.5 text-xs">
                {uploading
                  ? t('credentialsPage.upload.summaryUploading', {
                      completed: completedCount,
                      total: items.length,
                    })
                  : t('credentialsPage.upload.summaryComplete', {
                      success: successCount,
                      failed: failedItems.length,
                    })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {retryableItems.length > 1 && !uploading ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => void onRetryFailed()}
                >
                  <RotateCcw className="size-3" aria-hidden="true" />
                  {t('credentialsPage.upload.retryFailed')}
                </Button>
              ) : null}
              {!uploading ? (
                <Button type="button" variant="text" size="xs" onClick={onClear}>
                  {t('credentialsPage.upload.clearResults')}
                </Button>
              ) : null}
            </div>
          </div>

          <ul className="grid gap-2">
            {items.map((item) => {
              const retryable = isCredentialUploadRetryable(item.errorCode)
              const statusKey = getCredentialUploadStatusKey(item)

              return (
                <li key={item.id} className="bg-muted/35 grid min-w-0 gap-2 rounded-md border p-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <CredentialUploadStatusIcon item={item} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-xs leading-5',
                          item.status === 'error'
                            ? 'text-destructive'
                            : item.status === 'success'
                              ? 'text-success'
                              : 'text-muted-foreground',
                        )}
                      >
                        {t(statusKey, {
                          progress: item.progress,
                          name: item.resultName ?? item.file.name,
                        })}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatCredentialBytes(item.file.size)}
                      </p>
                    </div>
                    {item.status === 'error' && retryable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={uploading}
                        onClick={() => void onRetry(item)}
                      >
                        <RotateCcw className="size-3" aria-hidden="true" />
                        {t('credentialsPage.upload.retry')}
                      </Button>
                    ) : null}
                    {item.status !== 'uploading' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={uploading}
                        aria-label={t('credentialsPage.upload.removeResult', {
                          name: item.file.name,
                        })}
                        title={t('credentialsPage.upload.removeResult', {
                          name: item.file.name,
                        })}
                        onClick={() => onRemove(item.id)}
                      >
                        <X className="size-3" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                  {item.status === 'uploading' ? (
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.progress}
                      className="bg-muted h-1.5 overflow-hidden rounded-full"
                      aria-label={t('credentialsPage.upload.progressLabel', {
                        name: item.file.name,
                        progress: item.progress,
                      })}
                    >
                      <div
                        className="bg-primary h-full transition-[width] duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function getCredentialUploadStatusKey(item: CredentialUploadItem) {
  if (item.status === 'success') return 'credentialsPage.upload.states.success'
  if (item.status === 'error' && item.errorCode) {
    return `credentialsPage.upload.errors.${item.errorCode}`
  }
  if (item.status === 'uploading') return 'credentialsPage.upload.states.uploading'
  return 'credentialsPage.upload.states.queued'
}

function CredentialUploadStatusIcon({ item }: { item: CredentialUploadItem }) {
  if (item.status === 'success') {
    return <CircleCheck className="text-success mt-0.5 size-4" aria-hidden="true" />
  }
  if (item.status === 'error') {
    return <CircleX className="text-destructive mt-0.5 size-4" aria-hidden="true" />
  }
  if (item.status === 'uploading') {
    return <Loader2 className="text-primary mt-0.5 size-4 animate-spin" aria-hidden="true" />
  }
  return <FileJson className="text-muted-foreground mt-0.5 size-4" aria-hidden="true" />
}

export function CreateCredentialSheet({
  open,
  mode,
  fileInputRef,
  oauthProviders,
  oauthSessions,
  oauthStatuses,
  vertexImportResult,
  mutating,
  uploadItems,
  uploadInProgress,
  onOpenChange,
  onModeChange,
  onUpload,
  onRetryUpload,
  onRetryFailedUploads,
  onRemoveUploadResult,
  onClearUploadResults,
  onStartOAuth,
  onCheckOAuthStatus,
  onSubmitOAuthCallback,
  onImportVertex,
}: {
  open: boolean
  mode: CreateCredentialMode
  fileInputRef: React.RefObject<HTMLInputElement | null>
  oauthProviders: CredentialOAuthProvider[]
  oauthSessions: OAuthSessionMap
  oauthStatuses: OAuthStatusMap
  vertexImportResult: VertexImportResult | null
  mutating: boolean
  uploadItems: CredentialUploadItem[]
  uploadInProgress: boolean
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: CreateCredentialMode) => void
  onUpload: (fileList: FileList | null) => Promise<void>
  onRetryUpload: (item: CredentialUploadItem) => Promise<void>
  onRetryFailedUploads: () => Promise<void>
  onRemoveUploadResult: (itemId: string) => void
  onClearUploadResults: () => void
  onStartOAuth: (provider: CredentialOAuthProvider) => Promise<void>
  onCheckOAuthStatus: (provider: CredentialOAuthProvider, state: string) => Promise<void>
  onSubmitOAuthCallback: (input: CredentialOAuthCallbackInput) => Promise<void>
  onImportVertex: (input: { file: File; location: string }) => Promise<void>
}) {
  const { t } = useTranslation()
  const modes: CreateCredentialMode[] = ['oauth', 'upload', 'vertex']

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 overflow-hidden sm:max-w-xl"
        showCloseButton={!uploadInProgress}
        onEscapeKeyDown={(event) => {
          if (uploadInProgress) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (uploadInProgress) event.preventDefault()
        }}
      >
        <div className="border-b shadow-[0_1px_0_var(--border)]">
          <SheetHeader className="p-5 pb-3">
            <SheetTitle>{t('credentialsPage.create.title')}</SheetTitle>
            <SheetDescription>{t('credentialsPage.create.description')}</SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-5">
            <ToggleGroup
              type="single"
              value={mode}
              className="grid w-full grid-cols-3"
              onValueChange={(value) => {
                if (value) onModeChange(value as CreateCredentialMode)
              }}
            >
              {modes.map((item) => (
                <ToggleGroupItem
                  key={item}
                  value={item}
                  disabled={uploadInProgress}
                  className="data-[state=on]:bg-background data-[state=on]:text-foreground min-h-control-lg h-auto px-2 text-center whitespace-normal"
                >
                  {t(`credentialsPage.create.modes.${item}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 gap-5 overflow-x-hidden overflow-y-auto px-5 py-5">
          {mode === 'oauth' ? (
            <OAuthStartPanel
              providers={oauthProviders}
              sessions={oauthSessions}
              statuses={oauthStatuses}
              mutating={mutating}
              onStartOAuth={onStartOAuth}
              onCheckStatus={onCheckOAuthStatus}
              onSubmitCallback={onSubmitOAuthCallback}
            />
          ) : null}

          {mode === 'upload' ? (
            <JsonUploadPanel
              fileInputRef={fileInputRef}
              items={uploadItems}
              disabled={mutating || uploadInProgress}
              uploading={uploadInProgress}
              onUpload={onUpload}
              onRetry={onRetryUpload}
              onRetryFailed={onRetryFailedUploads}
              onRemove={onRemoveUploadResult}
              onClear={onClearUploadResults}
            />
          ) : null}

          {mode === 'vertex' ? (
            <VertexImportPanel
              compact
              result={vertexImportResult}
              mutating={mutating}
              onImport={onImportVertex}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
