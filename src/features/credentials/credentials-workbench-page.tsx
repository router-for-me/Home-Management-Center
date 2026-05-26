import { useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  CloudUpload,
  Download,
  ExternalLink,
  Eye,
  FileJson,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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

const oauthProviders: CredentialOAuthProvider[] = [
  'claude',
  'codex',
  'gemini',
  'antigravity',
  'kimi',
]
const oauthStatusToneClassNames: Record<string, string> = {
  ok: 'border-primary/30 bg-primary/10 text-primary',
  wait: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
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
  return (
    <section className="grid gap-5">
      <Skeleton className="h-32 rounded-lg" />
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
            <span>{t('credentialsPage.oauth.redirectUrl')}</span>
            <Input
              value={callbackForm.redirectUrl}
              placeholder="http://localhost/callback?code=...&state=..."
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

      <form className="mt-4 grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('credentialsPage.vertex.file')}</span>
          <Input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            disabled={mutating}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('credentialsPage.vertex.location')}</span>
          <Input
            value={location}
            placeholder="us-central1"
            disabled={mutating}
            onChange={(event) => setLocation(event.target.value)}
          />
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
  sessions,
  statuses,
  geminiProjectId,
  mutating,
  onGeminiProjectIdChange,
  onStartOAuth,
  onCheckStatus,
  onSubmitCallback,
}: {
  sessions: OAuthSessionMap
  statuses: OAuthStatusMap
  geminiProjectId: string
  mutating: boolean
  onGeminiProjectIdChange: (projectId: string) => void
  onStartOAuth: (provider: CredentialOAuthProvider) => Promise<void>
  onCheckStatus: (provider: CredentialOAuthProvider, state: string) => Promise<void>
  onSubmitCallback: (input: CredentialOAuthCallbackInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [advancedProvider, setAdvancedProvider] = useState<CredentialOAuthProvider | null>(null)

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        {oauthProviders.map((provider) => {
          const advancedOpen = advancedProvider === provider
          const isGemini = provider === 'gemini'
          const session = sessions[provider]
          const status = statuses[provider] ?? null

          return (
            <div key={provider} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {t(`credentialsPage.oauth.providers.${provider}`)}
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
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {t('credentialsPage.oauth.startLogin')}
                </Button>
              </div>

              {isGemini ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-xs"
                    onClick={() => setAdvancedProvider(advancedOpen ? null : provider)}
                  >
                    {advancedOpen
                      ? t('credentialsPage.oauth.hideAdvanced')
                      : t('credentialsPage.oauth.showAdvanced')}
                  </Button>
                  {advancedOpen ? (
                    <label className="mt-2 grid gap-2 text-sm font-medium">
                      <span>{t('credentialsPage.oauth.geminiProjectLabel')}</span>
                      <Input
                        value={geminiProjectId}
                        placeholder={t('credentialsPage.oauth.geminiProjectPlaceholder')}
                        disabled={mutating}
                        onChange={(event) => onGeminiProjectIdChange(event.target.value)}
                      />
                      <span className="text-muted-foreground text-xs leading-5">
                        {t('credentialsPage.oauth.geminiProjectHint')}
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}

              {session ? (
                <div className="mt-3">
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
  mutating,
  onUpload,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  mutating: boolean
  onUpload: (fileList: FileList | null) => Promise<void>
}) {
  const { t } = useTranslation()
  const [dragActive, setDragActive] = useState(false)

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    if (mutating) return
    void onUpload(event.dataTransfer.files)
  }

  return (
    <div className="grid gap-3">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'h-auto justify-start rounded-lg border border-dashed p-5 text-left',
          dragActive
            ? 'border-primary/60 bg-primary/5'
            : 'hover:border-primary/40 hover:bg-primary/5',
        )}
        disabled={mutating}
        onClick={openFilePicker}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!mutating) setDragActive(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!mutating) setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={handleDrop}
      >
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <Upload className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold">
              {t('credentialsPage.upload.title')}
            </span>
            <span className="text-muted-foreground mt-1 block text-sm leading-6">
              {t('credentialsPage.upload.description')}
            </span>
            <span className="text-muted-foreground mt-4 block text-xs leading-5">
              {t('credentialsPage.upload.actionHint')}
            </span>
          </span>
        </div>
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="hidden"
        onChange={(event) => void onUpload(event.target.files)}
      />
    </div>
  )
}

function CreateCredentialSheet({
  open,
  mode,
  fileInputRef,
  oauthSessions,
  oauthStatuses,
  vertexImportResult,
  geminiProjectId,
  mutating,
  onOpenChange,
  onModeChange,
  onGeminiProjectIdChange,
  onUpload,
  onStartOAuth,
  onCheckOAuthStatus,
  onSubmitOAuthCallback,
  onImportVertex,
}: {
  open: boolean
  mode: CreateCredentialMode
  fileInputRef: React.RefObject<HTMLInputElement | null>
  oauthSessions: OAuthSessionMap
  oauthStatuses: OAuthStatusMap
  vertexImportResult: VertexImportResult | null
  geminiProjectId: string
  mutating: boolean
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: CreateCredentialMode) => void
  onGeminiProjectIdChange: (projectId: string) => void
  onUpload: (fileList: FileList | null) => Promise<void>
  onStartOAuth: (provider: CredentialOAuthProvider) => Promise<void>
  onCheckOAuthStatus: (provider: CredentialOAuthProvider, state: string) => Promise<void>
  onSubmitOAuthCallback: (input: CredentialOAuthCallbackInput) => Promise<void>
  onImportVertex: (input: { file: File; location: string }) => Promise<void>
}) {
  const { t } = useTranslation()
  const modes: CreateCredentialMode[] = ['oauth', 'upload', 'vertex']

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle>{t('credentialsPage.create.title')}</SheetTitle>
          <SheetDescription>{t('credentialsPage.create.description')}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-5 pb-5">
          <ToggleGroup
            type="single"
            value={mode}
            className="grid grid-cols-3"
            onValueChange={(value) => {
              if (value) onModeChange(value as CreateCredentialMode)
            }}
          >
            {modes.map((item) => (
              <ToggleGroupItem
                key={item}
                value={item}
                className="data-[state=on]:bg-background data-[state=on]:text-foreground"
              >
                {t(`credentialsPage.create.modes.${item}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {mode === 'oauth' ? (
            <OAuthStartPanel
              sessions={oauthSessions}
              statuses={oauthStatuses}
              geminiProjectId={geminiProjectId}
              mutating={mutating}
              onGeminiProjectIdChange={onGeminiProjectIdChange}
              onStartOAuth={onStartOAuth}
              onCheckStatus={onCheckOAuthStatus}
              onSubmitCallback={onSubmitOAuthCallback}
            />
          ) : null}

          {mode === 'upload' ? (
            <JsonUploadPanel fileInputRef={fileInputRef} mutating={mutating} onUpload={onUpload} />
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
  mutating,
  onDeleteResource,
  onDownloadResource,
  onEditResource,
  onViewResource,
}: {
  resources: CredentialResource[]
  selectedResourceId: string | null
  mutating: boolean
  onDeleteResource: (resource: CredentialResource) => void
  onDownloadResource: (resource: CredentialResource) => void
  onEditResource: (resource: CredentialResource) => void
  onViewResource: (resource: CredentialResource) => void
}) {
  const { t } = useTranslation()

  if (resources.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border px-4 py-10 text-center text-sm">
        {t('credentialsPage.list.empty')}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <Table className="min-w-[1040px] table-fixed">
          <colgroup>
            <col className="w-[23%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            <col className="w-[22%]" />
          </colgroup>
          <TableHeader className="bg-muted/70 text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('credentialsPage.list.credential')}</TableHead>
              <TableHead>{t('credentialsPage.list.provider')}</TableHead>
              <TableHead>{t('credentialsPage.list.source')}</TableHead>
              <TableHead>{t('credentialsPage.list.type')}</TableHead>
              <TableHead>{t('credentialsPage.list.status')}</TableHead>
              <TableHead>{t('credentialsPage.list.updatedAt')}</TableHead>
              <TableHead className="text-right">{t('credentialsPage.list.actions')}</TableHead>
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
                  className={cn(
                    'hover:bg-accent/40 transition-colors',
                    resource.id === selectedResourceId ? 'bg-primary/8' : null,
                  )}
                >
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
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                        statusTone === 'positive'
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : statusTone === 'warning'
                            ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
                            : 'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      {statusTone === 'warning' ? (
                        <AlertTriangle className="size-3" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                      )}
                      {resource.disabled
                        ? t('credentialsPage.status.disabled')
                        : resource.unavailable
                          ? t('credentialsPage.status.unavailable')
                          : t(`credentialsPage.status.${resource.status}`, {
                              defaultValue: resource.status,
                            })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-muted-foreground truncate text-xs">{updatedAt}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
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
      </div>
    </div>
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
        <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
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
  const [panelMode, setPanelMode] = useState<MetadataPanelMode>('detail')
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [geminiProjectId, setGeminiProjectId] = useState('')
  const [oauthSessions, setOAuthSessions] = useState<OAuthSessionMap>({})
  const [oauthStatuses, setOAuthStatuses] = useState<OAuthStatusMap>({})
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateCredentialMode>('oauth')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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
  const activeCount = resources.filter(
    (resource) => !resource.disabled && !resource.unavailable,
  ).length
  const disabledCount = resources.filter((resource) => resource.disabled).length
  const unavailableCount = resources.filter((resource) => resource.unavailable).length

  useEffect(() => {
    if (selectedResourceId && !resources.some((resource) => resource.id === selectedResourceId)) {
      setSelectedResourceId(null)
      setPanelMode('detail')
      setDetailSheetOpen(false)
    }
  }, [resources, selectedResourceId])

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

  const handleUpload = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return

    try {
      await workbench.uploadCredentials(files)
      toast.success(t('credentialsPage.toast.uploaded'))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
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

  const handleToggleStatus = async (resource = selectedResource) => {
    if (!resource) return

    try {
      await workbench.updateStatus({
        resource,
        disabled: !resource.disabled,
      })
      toast.success(t('credentialsPage.toast.statusUpdated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDelete = async () => {
    if (!selectedResource) return

    try {
      await workbench.deleteCredential(selectedResource)
      toast.success(t('credentialsPage.toast.deleted'))
      setSelectedResourceId(null)
      setDetailSheetOpen(false)
      setDeleteDialogOpen(false)
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
        projectId: provider === 'gemini' ? geminiProjectId : undefined,
      })
      setOAuthSessions((current) => ({ ...current, [provider]: result }))
      setOAuthStatuses((current) => {
        const next = { ...current }
        delete next[provider]
        return next
      })
      window.open(result.url, '_blank', 'noopener,noreferrer')
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

  return (
    <section className="grid w-full gap-5">
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal">
              {t('credentialsPage.header.title')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
            {t('credentialsPage.header.activeResources', {
              active: activeCount,
              total: resources.length,
            })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('credentialsPage.header.disabledCount', { count: disabledCount })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('credentialsPage.header.unavailableCount', { count: unavailableCount })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('credentialsPage.header.updatedAt', {
              time: formatDateTime(workbench.snapshot.fetchedAt),
            })}
          </span>
        </div>
      </div>

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

        <div className="bg-card min-w-0 rounded-lg border p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t('credentialsPage.list.title')}</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {t('credentialsPage.list.description')}
              </p>
            </div>
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
          </div>
          <div className="mt-4">
            <CredentialList
              resources={filteredResources}
              selectedResourceId={selectedResourceId}
              mutating={workbench.mutating}
              onDeleteResource={(resource) => {
                setSelectedResourceId(resource.id)
                setPanelMode('detail')
                setDeleteDialogOpen(true)
              }}
              onDownloadResource={(resource) => void handleDownload(resource)}
              onEditResource={(resource) => {
                setSelectedResourceId(resource.id)
                setPanelMode('edit')
                setDetailSheetOpen(true)
              }}
              onViewResource={(resource) => {
                setSelectedResourceId(resource.id)
                setPanelMode('detail')
                setDetailSheetOpen(true)
              }}
            />
          </div>
        </div>
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
        oauthSessions={oauthSessions}
        oauthStatuses={oauthStatuses}
        vertexImportResult={workbench.vertexImportResult}
        geminiProjectId={geminiProjectId}
        mutating={workbench.mutating}
        onOpenChange={setCreateSheetOpen}
        onModeChange={setCreateMode}
        onGeminiProjectIdChange={setGeminiProjectId}
        onUpload={handleUpload}
        onStartOAuth={handleStartOAuth}
        onCheckOAuthStatus={handleCheckOAuthStatus}
        onSubmitOAuthCallback={handleSubmitOAuthCallback}
        onImportVertex={handleImportVertex}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('credentialsPage.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedResource
                ? t('credentialsPage.delete.confirm', {
                    name: getCredentialDisplayName(selectedResource),
                  })
                : null}
            </AlertDialogDescription>
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
                void handleDelete()
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('credentialsPage.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
