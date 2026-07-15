import { useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileJson,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TableEmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { ProviderLogo } from '@/components/shared/provider-logo'
import {
  TableSurface,
  TableSurfaceHeader,
  containedTableContainerClassName,
  stickyTableHeaderClassName,
} from '@/components/shared/table-surface'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCredentialWorkbench } from '@/features/credentials/use-credential-workbench'
import {
  type CredentialMetadataInput,
  type CredentialOAuthCallbackInput,
  type CredentialOAuthCallbackProvider,
  type CredentialOAuthProvider,
  type CredentialOAuthStatus,
  type CredentialResource,
  type CredentialStatusFilter,
  type VertexImportResult,
  isCodexCredentialResource,
} from '@/lib/api/management/credentials'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

import {
  type CredentialUploadErrorCode,
  type CredentialUploadItem,
  classifyCredentialUploadError,
  createCredentialUploadItem,
  validateCredentialUploadFile,
} from './credential-upload'

type MetadataPanelMode = 'detail' | 'edit'
type CreateCredentialMode = 'oauth' | 'upload' | 'vertex'
type CredentialMetadataForm = Omit<CredentialMetadataInput, 'websockets'> & {
  websockets: boolean
}
type OAuthSessionSummary = {
  provider: CredentialOAuthProvider
  state: string | null
  url: string
}
type OAuthSessionMap = Partial<Record<CredentialOAuthProvider, OAuthSessionSummary>>
type OAuthStatusMap = Partial<Record<CredentialOAuthProvider, CredentialOAuthStatus>>
type PendingCredentialConfirmation =
  | { type: 'delete'; resource: CredentialResource }
  | { type: 'bulkDelete'; resources: CredentialResource[] }

const MAX_CONCURRENT_CREDENTIAL_UPLOADS = 3

const oauthStatusToneClassNames: Record<string, string> = {
  ok: 'border-primary/30 bg-primary/10 text-primary',
  wait: 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  unknown: 'border-border bg-muted text-muted-foreground',
}

const credentialSourceNameKeys: Record<string, string> = {
  db: 'credentialsPage.sourceNames.db',
  database: 'credentialsPage.sourceNames.db',
  file: 'credentialsPage.sourceNames.file',
  memory: 'credentialsPage.sourceNames.memory',
  unknown: 'credentialsPage.sourceNames.unknown',
}

function isOAuthCallbackProvider(
  provider: CredentialOAuthProvider,
): provider is CredentialOAuthCallbackProvider {
  return provider !== 'kimi'
}

function isXaiOAuthProvider(provider: CredentialOAuthProvider): provider is 'xai' {
  return provider === 'xai'
}

function getCredentialSourceLabel(
  t: ReturnType<typeof useTranslation>['t'],
  source: string | null | undefined,
) {
  const normalizedSource = source?.trim().toLowerCase() || 'unknown'
  return t(credentialSourceNameKeys[normalizedSource] ?? 'credentialsPage.sourceNames.unknown')
}

function getCredentialProviderLabel(
  t: ReturnType<typeof useTranslation>['t'],
  provider: string | null | undefined,
) {
  const normalizedProvider = provider?.trim().toLowerCase()
  if (!normalizedProvider) return t('credentialsPage.status.notAvailable')

  const translationKey = `credentialsPage.oauth.providers.${normalizedProvider}`
  return t(translationKey, { defaultValue: provider ?? normalizedProvider })
}

function formatDateTime(value: string | null) {
  if (!value) return null

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatBytes(value: number | null) {
  if (value === null) return null
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function createMetadataForm(resource: CredentialResource | null): CredentialMetadataForm {
  return {
    prefix: resource?.prefix ?? '',
    proxyUrl: resource?.proxyUrl ?? '',
    priority:
      resource?.priority === null || resource?.priority === undefined
        ? ''
        : String(resource.priority),
    websockets: resource?.websockets ?? false,
    note: resource?.note ?? '',
  }
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

function getCredentialDisplayName(resource: CredentialResource) {
  return (
    resource.label ?? resource.email ?? resource.account ?? resource.name ?? resource.identifier
  )
}

function getStatusTone(resource: CredentialResource) {
  if (resource.disabled || resource.unavailable) return 'warning'
  if (resource.status === 'active') return 'positive'
  return 'neutral'
}

function CredentialDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('credentialsPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('credentialsPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t('credentialsPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function CredentialLoadingState() {
  const { t } = useTranslation()

  return (
    <section className="grid gap-5">
      <PageHeader
        title={t('credentialsPage.loading.title')}
        description={t('credentialsPage.loading.description')}
        tags={<Skeleton className="h-7 w-36 rounded-md" />}
      />
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="h-[560px] rounded-lg" />
        <Skeleton className="h-[560px] rounded-lg" />
      </div>
    </section>
  )
}

function CredentialErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-md border">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('credentialsPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('credentialsPage.error.description')}
              </p>
            </div>
          </div>
          <Button variant="outline" className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('credentialsPage.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function FilterPanel({
  resources,
  statusFilter,
  sourceFilter,
  providerFilter,
  onStatusFilterChange,
  onSourceFilterChange,
  onProviderFilterChange,
}: {
  resources: CredentialResource[]
  statusFilter: CredentialStatusFilter
  sourceFilter: string
  providerFilter: string
  onStatusFilterChange: (filter: CredentialStatusFilter) => void
  onSourceFilterChange: (source: string) => void
  onProviderFilterChange: (provider: string) => void
}) {
  const { t } = useTranslation()
  const sources = Array.from(new Set(resources.map((resource) => resource.source))).sort()
  const providers = Array.from(new Set(resources.map((resource) => resource.provider))).sort()
  const statusFilters: CredentialStatusFilter[] = ['all', 'active', 'disabled', 'unavailable']

  return (
    <aside className="bg-card min-w-0 rounded-lg border p-4 shadow-sm">
      <div>
        <p className="text-muted-foreground text-xs font-medium uppercase">
          {t('credentialsPage.filters.status')}
        </p>
        <ToggleGroup
          type="single"
          value={statusFilter}
          className="mt-3 grid gap-1 border-0 bg-transparent p-0 shadow-none"
          onValueChange={(value) => {
            if (value) onStatusFilterChange(value as CredentialStatusFilter)
          }}
        >
          {statusFilters.map((filter) => (
            <ToggleGroupItem
              key={filter}
              value={filter}
              className="data-[state=on]:border-primary/30 data-[state=off]:text-foreground h-auto justify-start border px-3 py-2 data-[state=off]:border-transparent"
            >
              {t(`credentialsPage.statusFilters.${filter}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-6">
        <p className="text-muted-foreground text-xs font-medium uppercase">
          {t('credentialsPage.filters.source')}
        </p>
        <ToggleGroup
          type="single"
          value={sourceFilter}
          className="mt-3 grid gap-1 border-0 bg-transparent p-0 shadow-none"
          onValueChange={(value) => {
            if (value) onSourceFilterChange(value)
          }}
        >
          <ToggleGroupItem
            value="all"
            className="data-[state=on]:border-primary/30 data-[state=off]:text-foreground h-auto justify-start border px-3 py-2 data-[state=off]:border-transparent"
          >
            {t('credentialsPage.filters.allSources')}
          </ToggleGroupItem>
          {sources.map((source) => (
            <ToggleGroupItem
              key={source}
              value={source}
              className="data-[state=on]:border-primary/30 data-[state=off]:text-foreground h-auto justify-start border px-3 py-2 data-[state=off]:border-transparent"
            >
              {getCredentialSourceLabel(t, source)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-6">
        <p className="text-muted-foreground text-xs font-medium uppercase">
          {t('credentialsPage.filters.provider')}
        </p>
        <ToggleGroup
          type="single"
          value={providerFilter}
          className="mt-3 grid gap-1 border-0 bg-transparent p-0 shadow-none"
          onValueChange={(value) => {
            if (value) onProviderFilterChange(value)
          }}
        >
          <ToggleGroupItem
            value="all"
            className="data-[state=on]:border-primary/30 data-[state=off]:text-foreground h-auto justify-start border px-3 py-2 data-[state=off]:border-transparent"
          >
            {t('credentialsPage.filters.allProviders')}
          </ToggleGroupItem>
          {providers.map((provider) => (
            <ToggleGroupItem
              key={provider}
              value={provider}
              className="data-[state=on]:border-primary/30 data-[state=off]:text-foreground h-auto justify-start border px-3 py-2 data-[state=off]:border-transparent"
            >
              {getCredentialProviderLabel(t, provider)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </aside>
  )
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
          <Button type="submit" variant="outline" size="sm" disabled={mutating}>
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
        <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
          <Copy className="size-4" aria-hidden="true" />
          {t('credentialsPage.oauth.copyAuthorizationLink')}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleOpen}>
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
          size="sm"
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
                        size: formatBytes(file.size),
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
                  size="sm"
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
                        {formatBytes(item.file.size)}
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

function isCredentialUploadRetryable(errorCode: CredentialUploadErrorCode | null) {
  return errorCode === 'network' || errorCode === 'server'
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

function CreateCredentialSheet({
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
                  className="data-[state=on]:bg-background data-[state=on]:text-foreground h-auto min-h-9 px-2 text-center whitespace-normal"
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

function CredentialList({
  resources,
  selectedResourceId,
  selectedResourceIds,
  mutating,
  onDeleteResource,
  onDownloadResource,
  onEditResource,
  onToggleSelection,
  onToggleAll,
  onToggleStatus,
  onViewResource,
}: {
  resources: CredentialResource[]
  selectedResourceId: string | null
  selectedResourceIds: Set<string>
  mutating: boolean
  onDeleteResource: (resource: CredentialResource) => void
  onDownloadResource: (resource: CredentialResource) => void
  onEditResource: (resource: CredentialResource) => void
  onToggleSelection: (resource: CredentialResource) => void
  onToggleAll: () => void
  onToggleStatus: (resource: CredentialResource, disabled: boolean) => void
  onViewResource: (resource: CredentialResource) => void
}) {
  const { t } = useTranslation()
  const allSelected =
    resources.length > 0 && resources.every((resource) => selectedResourceIds.has(resource.id))
  const partiallySelected =
    !allSelected && resources.some((resource) => selectedResourceIds.has(resource.id))

  if (resources.length === 0) {
    return <TableEmptyState kind="empty" className="m-0" title={t('credentialsPage.list.empty')} />
  }

  return (
    <Table
      containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
      className="min-w-[1410px] table-fixed"
    >
      <colgroup>
        <col className="w-[44px]" />
        <col className="w-[320px]" />
        <col className="w-[130px]" />
        <col className="w-[105px]" />
        <col className="w-[105px]" />
        <col className="w-[170px]" />
        <col className="w-[180px]" />
        <col className="w-[336px]" />
      </colgroup>
      <TableHeader className={stickyTableHeaderClassName}>
        <TableRow variant="static">
          <TableHead>
            <Checkbox
              checked={partiallySelected ? 'indeterminate' : allSelected}
              aria-label={t('credentialsPage.bulk.selectAll')}
              disabled={mutating}
              onCheckedChange={onToggleAll}
            />
          </TableHead>
          <TableHead>{t('credentialsPage.list.credential')}</TableHead>
          <TableHead>{t('credentialsPage.list.provider')}</TableHead>
          <TableHead>{t('credentialsPage.list.source')}</TableHead>
          <TableHead>{t('credentialsPage.list.type')}</TableHead>
          <TableHead>{t('credentialsPage.list.status')}</TableHead>
          <TableHead>{t('credentialsPage.list.updatedAt')}</TableHead>
          <TableHead className="table-sticky-action-head w-[336px] text-right">
            {t('credentialsPage.list.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => {
          const statusTone = getStatusTone(resource)
          const displayName = getCredentialDisplayName(resource)
          const providerLabel = getCredentialProviderLabel(t, resource.provider)
          const sourceLabel = getCredentialSourceLabel(t, resource.source)
          const updatedAt =
            formatDateTime(resource.updatedAt ?? resource.modifiedAt) ??
            t('credentialsPage.status.notAvailable')

          return (
            <TableRow
              key={resource.id}
              className={cn('group', resource.id === selectedResourceId ? 'bg-primary/8' : null)}
              variant="resource"
            >
              <TableCell>
                <Checkbox
                  checked={selectedResourceIds.has(resource.id)}
                  aria-label={t('credentialsPage.bulk.selectOne', {
                    name: displayName,
                  })}
                  disabled={mutating}
                  onCheckedChange={() => onToggleSelection(resource)}
                  onClick={(event) => event.stopPropagation()}
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                    <FileJson className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{displayName}</p>
                    <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                      {resource.name ?? resource.authIndex ?? resource.identifier}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <p className="truncate">{providerLabel}</p>
              </TableCell>
              <TableCell>
                <span className="inline-flex rounded-md border px-2 py-1 text-xs">
                  {sourceLabel}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground truncate font-mono text-xs">
                  {resource.type ?? t('credentialsPage.status.notAvailable')}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                      statusTone === 'positive'
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : statusTone === 'warning'
                          ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
                          : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {statusTone === 'warning' ? (
                      <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">
                      {resource.disabled
                        ? t('credentialsPage.status.disabled')
                        : resource.unavailable
                          ? t('credentialsPage.status.unavailable')
                          : t(`credentialsPage.status.${resource.status}`, {
                              defaultValue: resource.status,
                            })}
                    </span>
                  </span>
                  <Switch
                    checked={!resource.disabled}
                    disabled={mutating}
                    aria-label={t('credentialsPage.list.toggleStatus', {
                      name: displayName,
                    })}
                    onCheckedChange={(checked) => onToggleStatus(resource, !checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              </TableCell>
              <TableCell className="pr-4">
                <p className="text-muted-foreground truncate text-xs">{updatedAt}</p>
              </TableCell>
              <TableCell className="table-sticky-action-cell w-[336px] pl-4 text-right transition-colors">
                <div className="table-action-cell-content">
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    className="px-2"
                    aria-label={t('credentialsPage.actions.view')}
                    onClick={() => onViewResource(resource)}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    {t('credentialsPage.actions.view')}
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    className="px-2"
                    aria-label={t('credentialsPage.actions.edit')}
                    onClick={() => onEditResource(resource)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    {t('credentialsPage.actions.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    className="px-2"
                    disabled={mutating}
                    aria-label={t('credentialsPage.actions.download')}
                    onClick={() => onDownloadResource(resource)}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {t('credentialsPage.actions.download')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructiveText"
                    size="sm"
                    className="px-2"
                    disabled={mutating}
                    aria-label={t('credentialsPage.actions.delete')}
                    onClick={() => onDeleteResource(resource)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t('credentialsPage.actions.delete')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function CredentialDetailContent({
  resource,
  mode,
  mutating,
  models,
  onModeChange,
  onUpdateMetadata,
  onToggleStatus,
  onFetchModels,
}: {
  resource: CredentialResource | null
  mode: MetadataPanelMode
  mutating: boolean
  models: Array<{
    id: string
    displayName: string | null
    type: string | null
    ownedBy: string | null
  }> | null
  onModeChange: (mode: MetadataPanelMode) => void
  onUpdateMetadata: (input: CredentialMetadataInput) => Promise<void>
  onToggleStatus: () => Promise<void>
  onFetchModels: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<CredentialMetadataForm>(() => createMetadataForm(resource))
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setForm(createMetadataForm(resource))
    setLocalError(null)
  }, [resource, mode])

  if (!resource) {
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setLocalError(null)
      await onUpdateMetadata({
        prefix: form.prefix,
        proxyUrl: form.proxyUrl,
        priority: form.priority,
        note: form.note,
        ...(isCodexCredential ? { websockets: form.websockets } : {}),
      })
      onModeChange('detail')
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  const providerLabel = getCredentialProviderLabel(t, resource.provider)
  const sourceLabel = getCredentialSourceLabel(t, resource.source)
  const resourceIdentifier = resource.name ?? resource.authIndex ?? resource.identifier
  const isCodexCredential = isCodexCredentialResource(resource)

  if (mode === 'edit') {
    return (
      <div className="p-5">
        <p className="text-muted-foreground text-xs font-medium uppercase">
          {t('credentialsPage.form.eyebrow')}
        </p>
        <h2 className="mt-2 truncate text-base font-semibold">
          {getCredentialDisplayName(resource)}
        </h2>
        <div className="bg-muted/35 mt-4 rounded-md border px-3 py-3">
          <p className="text-muted-foreground text-xs font-medium">
            {t('credentialsPage.form.contextTitle')}
          </p>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            {[
              ['provider', providerLabel],
              ['source', sourceLabel],
              ['account', resource.account ?? resource.email ?? t('credentialsPage.status.notSet')],
              ['identifier', resourceIdentifier],
            ].map(([key, value]) => (
              <div key={key} className="min-w-0">
                <p className="text-muted-foreground">{t(`credentialsPage.form.context.${key}`)}</p>
                <p className="mt-1 truncate font-mono font-medium">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 text-xs leading-5">
            {isCodexCredential
              ? t('credentialsPage.form.editableHintWithWebsockets')
              : t('credentialsPage.form.editableHint')}
          </p>
        </div>
        <form className="mt-5 grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('credentialsPage.form.prefix')}</span>
            <Input
              value={form.prefix}
              disabled={mutating}
              onChange={(event) =>
                setForm((current) => ({ ...current, prefix: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('credentialsPage.form.proxyUrl')}</span>
            <Input
              value={form.proxyUrl}
              placeholder="http://127.0.0.1:7890"
              disabled={mutating}
              onChange={(event) =>
                setForm((current) => ({ ...current, proxyUrl: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('credentialsPage.form.priority')}</span>
            <Input
              value={form.priority}
              inputMode="numeric"
              disabled={mutating}
              onChange={(event) =>
                setForm((current) => ({ ...current, priority: event.target.value }))
              }
            />
          </label>
          {isCodexCredential ? (
            <div className="rounded-md border px-3 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('credentialsPage.form.websockets')}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {t('credentialsPage.form.websocketsHint')}
                  </p>
                </div>
                <Switch
                  checked={form.websockets}
                  disabled={mutating}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, websockets: checked }))
                  }
                  aria-label={t('credentialsPage.form.websockets')}
                />
              </div>
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('credentialsPage.form.note')}</span>
            <Textarea
              className="min-h-24"
              value={form.note}
              disabled={mutating}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </label>

          {localError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
              {localError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mutating}
              onClick={() => onModeChange('detail')}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('credentialsPage.actions.returnToDetail')}
            </Button>
            <Button type="submit" disabled={mutating}>
              {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {t('credentialsPage.actions.save')}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            {t('credentialsPage.detail.title')}
          </p>
          <h2 className="mt-2 truncate text-base font-semibold">
            {getCredentialDisplayName(resource)}
          </h2>
          <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
            {resourceIdentifier}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={mutating}
          onClick={() => onModeChange('edit')}
        >
          <Pencil className="size-4" aria-hidden="true" />
          {t('credentialsPage.actions.edit')}
        </Button>
      </div>

      <dl className="mt-5 grid gap-3 text-sm">
        {[
          ['provider', providerLabel],
          ['type', resource.type],
          ['source', sourceLabel],
          ['account', resource.account ?? resource.email ?? t('credentialsPage.status.notSet')],
          ['authIndex', resource.authIndex ?? t('credentialsPage.status.notAvailable')],
          ['path', resource.path ?? t('credentialsPage.status.notAvailable')],
          ['size', formatBytes(resource.size) ?? t('credentialsPage.status.notAvailable')],
          [
            'priority',
            resource.priority === null
              ? t('credentialsPage.status.notSet')
              : String(resource.priority),
          ],
          ...(isCodexCredential
            ? [
                [
                  'websockets',
                  resource.websockets
                    ? t('credentialsPage.status.enabled')
                    : t('credentialsPage.status.disabled'),
                ],
              ]
            : []),
          [
            'success',
            resource.success === null
              ? t('credentialsPage.status.notAvailable')
              : String(resource.success),
          ],
          [
            'failed',
            resource.failed === null
              ? t('credentialsPage.status.notAvailable')
              : String(resource.failed),
          ],
          [
            'updatedAt',
            formatDateTime(resource.updatedAt ?? resource.modifiedAt) ??
              t('credentialsPage.status.notAvailable'),
          ],
          [
            'lastRefresh',
            formatDateTime(resource.lastRefresh) ?? t('credentialsPage.status.notAvailable'),
          ],
          ['note', resource.note ?? t('credentialsPage.status.notSet')],
        ].map(([key, value]) => (
          <div key={key} className="rounded-md border px-3 py-2.5">
            <dt className="text-muted-foreground text-xs">
              {t(`credentialsPage.detail.fields.${key}`)}
            </dt>
            <dd className="mt-1 font-mono text-xs break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {resource.statusMessage ? (
        <div className="border-warning/35 bg-warning/12 mt-4 rounded-md border px-3 py-2.5 text-sm">
          {resource.statusMessage}
        </div>
      ) : null}

      <div className="bg-muted/25 mt-5 rounded-md border px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">{t('credentialsPage.detail.modelsTitle')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {models
                ? t('credentialsPage.detail.modelCount', { count: models.length })
                : t('credentialsPage.detail.modelsDescription')}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={mutating}
            onClick={() => void onFetchModels()}
          >
            {mutating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {models
              ? t('credentialsPage.actions.reloadModels')
              : t('credentialsPage.actions.viewModels')}
          </Button>
        </div>
        {models ? (
          <div className="bg-background/70 mt-3 max-h-44 overflow-y-auto rounded-md border p-2 text-xs">
            {models.length > 0 ? (
              models.slice(0, 20).map((model) => (
                <div key={model.id} className="border-b px-1 py-1.5 last:border-b-0">
                  <p className="font-mono">{model.id}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {model.displayName ??
                      model.ownedBy ??
                      model.type ??
                      t('credentialsPage.status.notAvailable')}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground px-1 py-2">
                {t('credentialsPage.detail.noModels')}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="border-warning/25 bg-warning/8 mt-5 rounded-md border px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">{t('credentialsPage.detail.statusActionTitle')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {resource.disabled
                ? t('credentialsPage.detail.enableDescription')
                : t('credentialsPage.detail.disableDescription')}
            </p>
          </div>
          <Button
            type="button"
            variant={resource.disabled ? 'secondary' : 'warning'}
            size="sm"
            disabled={mutating}
            onClick={() => void onToggleStatus()}
          >
            {resource.disabled
              ? t('credentialsPage.actions.enable')
              : t('credentialsPage.actions.disable')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CredentialsWorkbenchPage() {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const workbench = useCredentialWorkbench()
  const [statusFilter, setStatusFilter] = useState<CredentialStatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(() => new Set())
  const [panelMode, setPanelMode] = useState<MetadataPanelMode>('detail')
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [oauthSessions, setOAuthSessions] = useState<OAuthSessionMap>({})
  const [oauthStatuses, setOAuthStatuses] = useState<OAuthStatusMap>({})
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateCredentialMode>('oauth')
  const [uploadItems, setUploadItems] = useState<CredentialUploadItem[]>([])
  const [confirmation, setConfirmation] = useState<PendingCredentialConfirmation | null>(null)

  const resources = workbench.snapshot?.resources ?? []
  const filteredResources = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return resources.filter((resource) => {
      if (statusFilter === 'active' && (resource.disabled || resource.unavailable)) return false
      if (statusFilter === 'disabled' && !resource.disabled) return false
      if (statusFilter === 'unavailable' && !resource.unavailable) return false
      if (sourceFilter !== 'all' && resource.source !== sourceFilter) return false
      if (providerFilter !== 'all' && resource.provider !== providerFilter) return false
      if (!normalizedSearch) return true

      return [
        getCredentialDisplayName(resource),
        resource.name,
        resource.authIndex,
        resource.email,
        resource.account,
        resource.provider,
        resource.type,
        resource.source,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch))
    })
  }, [providerFilter, resources, search, sourceFilter, statusFilter])
  const selectedResource =
    filteredResources.find((resource) => resource.id === selectedResourceId) ??
    resources.find((resource) => resource.id === selectedResourceId) ??
    null
  const selectedResources = resources.filter((resource) => selectedResourceIds.has(resource.id))
  const selectedDisabledCount = selectedResources.filter((resource) => resource.disabled).length
  const selectedEnabledCount = selectedResources.length - selectedDisabledCount
  const activeCount = resources.filter(
    (resource) => !resource.disabled && !resource.unavailable,
  ).length
  const unavailableCount = resources.filter((resource) => resource.unavailable).length
  const uploadInProgress = uploadItems.some(
    (item) => item.status === 'queued' || item.status === 'uploading',
  )

  useEffect(() => {
    if (selectedResourceId && !resources.some((resource) => resource.id === selectedResourceId)) {
      setSelectedResourceId(null)
      setPanelMode('detail')
      setDetailSheetOpen(false)
    }
  }, [resources, selectedResourceId])

  useEffect(() => {
    const resourceIds = new Set(resources.map((resource) => resource.id))
    setSelectedResourceIds((current) => {
      const nextSelection = new Set(
        Array.from(current).filter((resourceId) => resourceIds.has(resourceId)),
      )

      return nextSelection.size === current.size ? current : nextSelection
    })
  }, [resources])

  if (workbench.checking) {
    return <CredentialLoadingState />
  }

  if (!workbench.connected) {
    return <CredentialDisconnectedState />
  }

  if (workbench.isPending) {
    return <CredentialLoadingState />
  }

  if (workbench.isError || !workbench.snapshot) {
    return (
      <CredentialErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
    )
  }

  const updateUploadItem = (itemId: string, patch: Partial<CredentialUploadItem>) => {
    setUploadItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    )
  }

  const runCredentialUploads = async (items: CredentialUploadItem[]) => {
    if (items.length === 0) return

    let nextIndex = 0
    let successfulUploads = 0
    const worker = async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex]
        nextIndex += 1
        updateUploadItem(item.id, {
          status: 'uploading',
          progress: 0,
          resultName: null,
          errorCode: null,
        })

        try {
          const result = await workbench.uploadCredential(item.file, (progress) => {
            updateUploadItem(item.id, { progress })
          })
          successfulUploads += 1
          updateUploadItem(item.id, {
            status: 'success',
            progress: 100,
            resultName: result.files[0] ?? item.file.name,
            errorCode: null,
          })
        } catch (error) {
          updateUploadItem(item.id, {
            status: 'error',
            progress: 0,
            resultName: null,
            errorCode: classifyCredentialUploadError(error),
          })
        }
      }
    }
    const workerCount = Math.min(MAX_CONCURRENT_CREDENTIAL_UPLOADS, items.length)

    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    if (successfulUploads > 0) {
      await workbench.refreshCredentials()
    }
  }

  const handleUpload = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (files.length === 0) return

    const items = files.map(createCredentialUploadItem)
    setUploadItems((current) => [...current, ...items])
    const validationResults = await Promise.all(
      items.map(async (item) => ({
        item,
        errorCode: await validateCredentialUploadFile(item.file),
      })),
    )
    const uploadableItems: CredentialUploadItem[] = []

    validationResults.forEach(({ item, errorCode }) => {
      if (errorCode) {
        updateUploadItem(item.id, { status: 'error', errorCode })
      } else {
        uploadableItems.push(item)
      }
    })

    await runCredentialUploads(uploadableItems)
  }

  const handleRetryUpload = async (item: CredentialUploadItem) => {
    await runCredentialUploads([item])
  }

  const handleRetryFailedUploads = async () => {
    await runCredentialUploads(
      uploadItems.filter(
        (item) => item.status === 'error' && isCredentialUploadRetryable(item.errorCode),
      ),
    )
  }

  const handleCreateSheetOpenChange = (open: boolean) => {
    if (!open && uploadInProgress) return

    setCreateSheetOpen(open)
    if (!open) {
      setUploadItems([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (resource = selectedResource) => {
    if (!resource) return

    try {
      const result = await workbench.downloadCredential(resource)
      const url = window.URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      window.URL.revokeObjectURL(url)
      toast.success(t('credentialsPage.toast.downloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleSetStatus = async (resource: CredentialResource, disabled: boolean) => {
    try {
      await workbench.updateStatus({
        resource,
        disabled,
      })
      toast.success(t('credentialsPage.toast.statusUpdated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleToggleStatus = async (resource = selectedResource) => {
    if (!resource) return
    await handleSetStatus(resource, !resource.disabled)
  }

  const handleToggleSelection = (resource: CredentialResource) => {
    setSelectedResourceIds((current) => {
      const nextSelection = new Set(current)

      if (nextSelection.has(resource.id)) {
        nextSelection.delete(resource.id)
      } else {
        nextSelection.add(resource.id)
      }

      return nextSelection
    })
  }

  const handleToggleAll = () => {
    setSelectedResourceIds((current) => {
      const everyFilteredResourceSelected = filteredResources.every((resource) =>
        current.has(resource.id),
      )
      const nextSelection = new Set(current)

      for (const resource of filteredResources) {
        if (everyFilteredResourceSelected) {
          nextSelection.delete(resource.id)
        } else {
          nextSelection.add(resource.id)
        }
      }

      return nextSelection
    })
  }

  const handleBulkStatus = async (disabled: boolean) => {
    if (selectedResources.length === 0) return

    try {
      await workbench.bulkUpdateStatus({
        resources: selectedResources,
        disabled,
      })
      toast.success(
        t(disabled ? 'credentialsPage.toast.bulkDisabled' : 'credentialsPage.toast.bulkEnabled', {
          count: selectedResources.length,
        }),
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDelete = (resource = selectedResource) => {
    if (!resource) return
    setConfirmation({ type: 'delete', resource })
  }

  const handleBulkDelete = () => {
    if (selectedResources.length === 0) return
    setConfirmation({ type: 'bulkDelete', resources: selectedResources })
  }

  const handleConfirmAction = async () => {
    const currentConfirmation = confirmation
    if (!currentConfirmation) return

    try {
      if (currentConfirmation.type === 'delete') {
        await workbench.deleteCredential(currentConfirmation.resource)
        toast.success(t('credentialsPage.toast.deleted'))
        setSelectedResourceIds((current) => {
          const nextSelection = new Set(current)
          nextSelection.delete(currentConfirmation.resource.id)
          return nextSelection
        })
        if (selectedResourceId === currentConfirmation.resource.id) {
          setSelectedResourceId(null)
          setDetailSheetOpen(false)
        }
      } else {
        await workbench.bulkDeleteCredentials(currentConfirmation.resources)
        toast.success(
          t('credentialsPage.toast.bulkDeleted', {
            count: currentConfirmation.resources.length,
          }),
        )
        setSelectedResourceIds(new Set())
        if (
          selectedResourceId &&
          currentConfirmation.resources.some((resource) => resource.id === selectedResourceId)
        ) {
          setSelectedResourceId(null)
          setDetailSheetOpen(false)
        }
      }

      setPanelMode('detail')
      setConfirmation(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleMetadataUpdate = async (input: CredentialMetadataInput) => {
    if (!selectedResource) return
    await workbench.updateMetadata({
      resource: selectedResource,
      input,
    })
    toast.success(t('credentialsPage.toast.updated'))
  }

  const handleFetchModels = async () => {
    if (!selectedResource) return

    try {
      await workbench.fetchModels(selectedResource)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleStartOAuth = async (provider: CredentialOAuthProvider) => {
    try {
      const result = await workbench.startOAuth({
        provider,
      })
      setOAuthSessions((current) => ({ ...current, [provider]: result }))
      setOAuthStatuses((current) => {
        const next = { ...current }
        delete next[provider]
        return next
      })
      toast.success(t('credentialsPage.toast.oauthStarted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleCheckOAuthStatus = async (provider: CredentialOAuthProvider, state: string) => {
    const result = await workbench.checkOAuthStatus(state)
    setOAuthStatuses((current) => ({ ...current, [provider]: result }))
    toast.success(
      t('credentialsPage.toast.oauthStatusChecked', {
        status: t(`credentialsPage.oauth.statuses.${result.status}`, {
          defaultValue: result.status,
        }),
      }),
    )
  }

  const handleSubmitOAuthCallback = async (input: CredentialOAuthCallbackInput) => {
    await workbench.submitOAuthCallback(input)
    toast.success(t('credentialsPage.toast.oauthCallbackSubmitted'))
  }

  const handleImportVertex = async (input: { file: File; location: string }) => {
    await workbench.importVertexCredential(input)
    toast.success(t('credentialsPage.toast.vertexImported'))
  }

  const confirmationCopy =
    confirmation?.type === 'delete'
      ? {
          title: t('credentialsPage.delete.title'),
          description: t('credentialsPage.delete.confirm', {
            name: getCredentialDisplayName(confirmation.resource),
          }),
          action: t('credentialsPage.actions.delete'),
        }
      : confirmation?.type === 'bulkDelete'
        ? {
            title: t('credentialsPage.bulk.deleteTitle'),
            description: t('credentialsPage.bulk.deleteConfirm', {
              count: confirmation.resources.length,
            }),
            action: t('credentialsPage.bulk.deleteSelected'),
          }
        : null

  return (
    <section className="grid w-full gap-5">
      <PageHeader
        title={t('credentialsPage.header.title')}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={workbench.isFetching}
              onClick={workbench.refetch}
              aria-label={
                workbench.isFetching
                  ? t('credentialsPage.actions.syncing')
                  : t('credentialsPage.actions.refresh')
              }
              title={
                workbench.isFetching
                  ? t('credentialsPage.actions.syncing')
                  : t('credentialsPage.actions.refresh')
              }
            >
              {workbench.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {workbench.isFetching
                ? t('credentialsPage.actions.syncing')
                : t('credentialsPage.actions.refresh')}
            </Button>
            <Button
              size="sm"
              disabled={workbench.mutating}
              onClick={() => setCreateSheetOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('credentialsPage.actions.addCredential')}
            </Button>
          </>
        }
        tags={
          <>
            <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
              {t('credentialsPage.header.activeResources', {
                active: activeCount,
                total: resources.length,
              })}
            </span>
            {unavailableCount > 0 ? (
              <span className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-2.5 py-1 text-xs font-medium">
                {t('credentialsPage.header.unavailableCount', { count: unavailableCount })}
              </span>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <FilterPanel
          resources={resources}
          statusFilter={statusFilter}
          sourceFilter={sourceFilter}
          providerFilter={providerFilter}
          onStatusFilterChange={setStatusFilter}
          onSourceFilterChange={setSourceFilter}
          onProviderFilterChange={setProviderFilter}
        />

        <TableSurface className="min-w-0">
          <TableSurfaceHeader
            title={t('credentialsPage.list.title')}
            actions={
              <div className="relative min-w-0 md:w-72">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('credentialsPage.list.filterPlaceholder')}
                />
              </div>
            }
            actionsClassName="w-full md:w-auto"
          />
          <div className="p-4">
            {selectedResourceIds.size > 0 ? (
              <div className="bg-muted/60 mb-3 flex flex-col gap-3 rounded-md border px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t('credentialsPage.bulk.selected', { count: selectedResourceIds.size })}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t('credentialsPage.bulk.selectedSummary', {
                      enabled: selectedEnabledCount,
                      disabled: selectedDisabledCount,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={workbench.mutating}
                    onClick={() => setSelectedResourceIds(new Set())}
                  >
                    {t('credentialsPage.bulk.clearSelection')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={workbench.mutating || selectedDisabledCount === 0}
                    onClick={() => void handleBulkStatus(false)}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {t('credentialsPage.bulk.enableSelected')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={workbench.mutating || selectedEnabledCount === 0}
                    onClick={() => void handleBulkStatus(true)}
                  >
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    {t('credentialsPage.bulk.disableSelected')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={workbench.mutating}
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t('credentialsPage.bulk.deleteSelected')}
                  </Button>
                </div>
              </div>
            ) : null}
            <CredentialList
              resources={filteredResources}
              selectedResourceId={selectedResourceId}
              selectedResourceIds={selectedResourceIds}
              mutating={workbench.mutating}
              onDeleteResource={(resource) => {
                handleDelete(resource)
              }}
              onDownloadResource={(resource) => void handleDownload(resource)}
              onEditResource={(resource) => {
                setSelectedResourceId(resource.id)
                setPanelMode('edit')
                setDetailSheetOpen(true)
              }}
              onToggleSelection={handleToggleSelection}
              onToggleAll={handleToggleAll}
              onToggleStatus={(resource, disabled) => {
                void handleSetStatus(resource, disabled)
              }}
              onViewResource={(resource) => {
                setSelectedResourceId(resource.id)
                setPanelMode('detail')
                setDetailSheetOpen(true)
              }}
            />
          </div>
        </TableSurface>
      </div>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-5">
            <SheetTitle>
              {panelMode === 'edit'
                ? t('credentialsPage.form.eyebrow')
                : t('credentialsPage.detail.title')}
            </SheetTitle>
            <SheetDescription>
              {selectedResource
                ? getCredentialDisplayName(selectedResource)
                : t('credentialsPage.detail.empty')}
            </SheetDescription>
          </SheetHeader>
          <CredentialDetailContent
            resource={selectedResource}
            mode={panelMode}
            mutating={workbench.mutating}
            models={workbench.models}
            onModeChange={setPanelMode}
            onUpdateMetadata={handleMetadataUpdate}
            onToggleStatus={() => handleToggleStatus(selectedResource)}
            onFetchModels={handleFetchModels}
          />
        </SheetContent>
      </Sheet>

      <CreateCredentialSheet
        open={createSheetOpen}
        mode={createMode}
        fileInputRef={fileInputRef}
        oauthProviders={workbench.oauthProviders}
        oauthSessions={oauthSessions}
        oauthStatuses={oauthStatuses}
        vertexImportResult={workbench.vertexImportResult}
        mutating={workbench.mutating}
        uploadItems={uploadItems}
        uploadInProgress={uploadInProgress}
        onOpenChange={handleCreateSheetOpenChange}
        onModeChange={setCreateMode}
        onUpload={handleUpload}
        onRetryUpload={handleRetryUpload}
        onRetryFailedUploads={handleRetryFailedUploads}
        onRemoveUploadResult={(itemId) => {
          setUploadItems((current) => current.filter((item) => item.id !== itemId))
        }}
        onClearUploadResults={() => setUploadItems([])}
        onStartOAuth={handleStartOAuth}
        onCheckOAuthStatus={handleCheckOAuthStatus}
        onSubmitOAuthCallback={handleSubmitOAuthCallback}
        onImportVertex={handleImportVertex}
      />

      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !workbench.mutating) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmAction()
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {confirmationCopy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
