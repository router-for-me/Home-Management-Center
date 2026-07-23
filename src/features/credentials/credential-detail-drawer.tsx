import { useEffect, useState } from 'react'

import { AlertTriangle, CircleGauge, Download, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DrawerScaffoldBody,
  DrawerScaffoldFooter,
  DrawerScaffoldHeader,
} from '@/components/shared/drawer-scaffold'
import { ProviderLogo } from '@/components/shared/provider-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  CredentialConcurrencyDetail,
  CredentialConcurrencyEditor,
  type CredentialMetadataForm,
  canonicalConcurrencyModelKey,
  getCredentialInFlightId,
  isValidConcurrencyModelKey,
  parseConcurrencyLimit,
} from '@/features/credentials/credential-concurrency'
import {
  formatCredentialBytes,
  formatCredentialDateTime,
  getCredentialDisplayName,
  getCredentialProviderLabel,
  getCredentialSourceLabel,
} from '@/features/credentials/credential-display'
import {
  useCredentialConcurrencyPolicy,
  useCredentialInFlightDetail,
} from '@/features/credentials/use-credential-workbench'
import {
  InlineWindowBar,
  UpstreamQuotaMetaBadge,
  UpstreamQuotaPlanBadge,
  UpstreamQuotaStatusBadge,
} from '@/features/upstream/quota-cells'
import {
  type AntigravityQuotaGroup,
  type UpstreamQuotaEntry,
  findCurrencyWindow,
  findXaiOnDemandWindow,
  resolveAntigravityQuotaPresentation,
} from '@/features/upstream/upstream-quota-model'
import { useUpstreamQuotaCredentialDetail } from '@/features/upstream/use-upstream-quota'
import {
  type CredentialConcurrencyPolicy,
  type CredentialInFlightObservationMetadata,
  type CredentialInFlightSummary,
  type CredentialMetadataInput,
  type CredentialResource,
  supportsCredentialWebsockets,
} from '@/lib/api/management/credentials'
import type { QuotaCredential, QuotaResetCredits, QuotaWindow } from '@/lib/api/management/quota'
import { cn } from '@/lib/utils'

export type CredentialDrawerTab =
  | 'overview'
  | 'metadata'
  | 'quota'
  | 'concurrency'
  | 'models'
  | 'danger'

function visibleDrawerTabs(showConcurrency: boolean): CredentialDrawerTab[] {
  return [
    'overview',
    'metadata',
    'quota',
    ...(showConcurrency ? (['concurrency'] as const) : []),
    'models',
    'danger',
  ]
}

function createMetadataForm(
  resource: CredentialResource | null,
  policy: CredentialConcurrencyPolicy | null = null,
): CredentialMetadataForm {
  const maxInFlight = policy?.maxInFlight ?? resource?.maxInFlight ?? null
  const maxInFlightByModel = policy?.maxInFlightByModel ?? resource?.maxInFlightByModel ?? {}
  return {
    prefix: resource?.prefix ?? '',
    proxyUrl: resource?.proxyUrl ?? '',
    priority:
      resource?.priority === null || resource?.priority === undefined
        ? ''
        : String(resource.priority),
    websockets: resource?.websockets ?? false,
    note: resource?.note ?? '',
    maxInFlight: maxInFlight ? String(maxInFlight) : '',
    maxInFlightByModel: Object.entries(maxInFlightByModel)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([model, limit]) => ({ model, limit: String(limit) })),
  }
}

function DrawerTabStrip({
  activeTab,
  showConcurrency,
  onTabChange,
}: {
  activeTab: CredentialDrawerTab
  showConcurrency: boolean
  onTabChange: (tab: CredentialDrawerTab) => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="bg-muted/45 flex shrink-0 gap-1 overflow-x-auto border-b px-4 py-2"
      role="tablist"
      aria-label={t('upstreamPage.drawer.tabs.label')}
    >
      {visibleDrawerTabs(showConcurrency).map((tab) => (
        <Button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          variant={activeTab === tab ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => onTabChange(tab)}
        >
          {t(`upstreamPage.drawer.tabs.${tab}`)}
        </Button>
      ))}
    </div>
  )
}

function OverviewTab({
  resource,
  quotaEntry,
}: {
  resource: CredentialResource
  quotaEntry: UpstreamQuotaEntry | null
}) {
  const { t } = useTranslation()
  const providerLabel = getCredentialProviderLabel(t, resource.provider)
  const sourceLabel = getCredentialSourceLabel(t, resource.source)
  const websocketsSupported = supportsCredentialWebsockets(resource)

  return (
    <div className="grid gap-3">
      <dl className="grid gap-3 text-sm">
        {[
          ['provider', providerLabel],
          ['type', resource.type],
          ['source', sourceLabel],
          ['account', resource.account ?? resource.email ?? t('credentialsPage.status.notSet')],
          ['authIndex', resource.authIndex ?? t('credentialsPage.status.notAvailable')],
          ['prefix', resource.prefix ?? t('credentialsPage.status.notSet')],
          ['proxyUrl', resource.proxyUrl ?? t('credentialsPage.status.notSet')],
          [
            'priority',
            resource.priority === null
              ? t('credentialsPage.status.notSet')
              : String(resource.priority),
          ],
          [
            'websockets',
            websocketsSupported
              ? resource.websockets
                ? t('credentialsPage.status.enabled')
                : t('credentialsPage.status.disabled')
              : t('credentialsPage.inline.notApplicable'),
          ],
          ['path', resource.path ?? t('credentialsPage.status.notAvailable')],
          [
            'size',
            formatCredentialBytes(resource.size) ?? t('credentialsPage.status.notAvailable'),
          ],
          [
            'updatedAt',
            formatCredentialDateTime(resource.updatedAt ?? resource.modifiedAt) ??
              t('credentialsPage.status.notAvailable'),
          ],
          [
            'lastRefresh',
            formatCredentialDateTime(resource.lastRefresh) ??
              t('credentialsPage.status.notAvailable'),
          ],
          ['note', resource.note ?? t('credentialsPage.status.notSet')],
          [
            'quotaStatus',
            quotaEntry
              ? t(`upstreamPage.quota.status.${quotaEntry.status}`)
              : t('credentialsPage.status.notAvailable'),
          ],
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
        <div className="border-warning/35 bg-warning/12 rounded-md border px-3 py-2.5 text-sm">
          {resource.statusMessage}
        </div>
      ) : null}
    </div>
  )
}

function MetadataTab({
  resource,
  mutating,
  canEditConcurrency,
  concurrencyPolicy,
  concurrencyPolicyPending,
  concurrencyPolicyError,
  inFlightSummary,
  onUpdateMetadata,
  onToggleStatus,
}: {
  resource: CredentialResource
  mutating: boolean
  canEditConcurrency: boolean
  concurrencyPolicy: CredentialConcurrencyPolicy | null
  concurrencyPolicyPending: boolean
  concurrencyPolicyError: string | null
  inFlightSummary: CredentialInFlightSummary | null
  onUpdateMetadata: (input: CredentialMetadataInput) => Promise<void>
  onToggleStatus: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<CredentialMetadataForm>(() =>
    createMetadataForm(resource, concurrencyPolicy),
  )
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setForm(createMetadataForm(resource, concurrencyPolicy))
    setLocalError(null)
  }, [concurrencyPolicy, resource])

  const websocketsSupported = supportsCredentialWebsockets(resource)
  const isXaiCredential = resource.provider.trim().toLowerCase() === 'xai'
  const concurrencyEditable = canEditConcurrency && concurrencyPolicy !== null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setLocalError(null)
      const maxInFlight = parseConcurrencyLimit(form.maxInFlight)
      if (concurrencyEditable && maxInFlight === undefined) {
        throw new Error(t('credentialsPage.concurrency.validation.totalLimit'))
      }
      const maxInFlightByModel: Record<string, number> = {}
      if (concurrencyEditable) {
        for (const row of form.maxInFlightByModel) {
          const model = canonicalConcurrencyModelKey(row.model)
          const rawLimit = row.limit.trim()
          if (!model && !rawLimit) continue
          if (!isValidConcurrencyModelKey(row.model)) {
            throw new Error(t('credentialsPage.concurrency.validation.modelInvalid'))
          }
          const limit = parseConcurrencyLimit(row.limit)
          if (limit === undefined) {
            if (!model) {
              throw new Error(t('credentialsPage.concurrency.validation.modelRequired'))
            }
            throw new Error(t('credentialsPage.concurrency.validation.modelLimit', { model }))
          }
          if (!model) {
            if (limit === null || limit === 0) continue
            throw new Error(t('credentialsPage.concurrency.validation.modelRequired'))
          }
          if (limit === null || limit === 0) continue
          if (Object.prototype.hasOwnProperty.call(maxInFlightByModel, model)) {
            throw new Error(t('credentialsPage.concurrency.validation.duplicateModel', { model }))
          }
          maxInFlightByModel[model] = limit
        }
      }
      const normalizedMaxInFlight = maxInFlight && maxInFlight > 0 ? maxInFlight : null
      const currentModelLimits = concurrencyPolicy?.maxInFlightByModel ?? {}
      const modelLimitsChanged =
        Object.keys(currentModelLimits).length !== Object.keys(maxInFlightByModel).length ||
        Object.entries(maxInFlightByModel).some(
          ([model, limit]) => currentModelLimits[model] !== limit,
        )
      const concurrencyChanged =
        concurrencyEditable &&
        (normalizedMaxInFlight !== concurrencyPolicy?.maxInFlight || modelLimitsChanged)
      await onUpdateMetadata({
        prefix: form.prefix,
        proxyUrl: form.proxyUrl,
        priority: form.priority,
        note: form.note,
        ...(websocketsSupported ? { websockets: form.websockets } : {}),
        ...(concurrencyChanged
          ? {
              maxInFlight: normalizedMaxInFlight,
              maxInFlightByModel,
              concurrencyVersion: concurrencyPolicy?.version,
            }
          : {}),
      })
    } catch (error) {
      const backendCode =
        error && typeof error === 'object' && 'backendCode' in error
          ? String(error.backendCode)
          : null
      setLocalError(
        backendCode === 'concurrency_policy_version_conflict'
          ? t('credentialsPage.concurrency.versionConflict')
          : error instanceof Error
            ? error.message
            : String(error),
      )
    }
  }

  return (
    <form
      id="credential-metadata-form"
      className="grid gap-4"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('credentialsPage.form.proxyUrl')}</span>
        <Input
          value={form.proxyUrl}
          placeholder="socks5://user:pass@host:port/"
          disabled={mutating}
          onChange={(event) => setForm((current) => ({ ...current, proxyUrl: event.target.value }))}
        />
        <span className="text-muted-foreground text-xs leading-5 font-normal">
          {t('upstreamPage.drawer.metadata.proxyHint')}
        </span>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('credentialsPage.form.priority')}</span>
        <Input
          value={form.priority}
          inputMode="numeric"
          placeholder={t('upstreamPage.drawer.metadata.priorityPlaceholder')}
          disabled={mutating}
          onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
        />
        <span className="text-muted-foreground text-xs leading-5 font-normal">
          {t('upstreamPage.drawer.metadata.priorityHint')}
        </span>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('credentialsPage.form.note')}</span>
        <Textarea
          className="min-h-24"
          value={form.note}
          disabled={mutating}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
        />
      </label>

      <p className="text-muted-foreground mt-1 text-xs font-semibold tracking-wide uppercase">
        {t('upstreamPage.drawer.metadata.secondarySection')}
      </p>
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('credentialsPage.form.prefix')}</span>
        <Input
          value={form.prefix}
          disabled={mutating}
          onChange={(event) => setForm((current) => ({ ...current, prefix: event.target.value }))}
        />
        <span className="text-muted-foreground text-xs leading-5 font-normal">
          {t('upstreamPage.drawer.metadata.prefixHint')}
        </span>
      </label>

      <div className="bg-muted/35 rounded-md border px-3 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('credentialsPage.form.websockets')}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {websocketsSupported
                ? isXaiCredential
                  ? t('upstreamPage.drawer.metadata.websocketsXaiHint')
                  : t('credentialsPage.form.websocketsHint')
                : t('upstreamPage.drawer.metadata.websocketsUnsupported')}
            </p>
          </div>
          {websocketsSupported ? (
            <Switch
              checked={form.websockets}
              disabled={mutating}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, websockets: checked }))
              }
              aria-label={t('credentialsPage.form.websockets')}
            />
          ) : (
            <span className="border-border bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium">
              {t('credentialsPage.inline.notApplicable')}
            </span>
          )}
        </div>
      </div>

      <div className="bg-muted/35 rounded-md border px-3 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('upstreamPage.drawer.metadata.enableTitle')}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('upstreamPage.drawer.metadata.enableDescription')}
            </p>
          </div>
          <Switch
            checked={!resource.disabled}
            disabled={mutating}
            onCheckedChange={() => void onToggleStatus()}
            aria-label={t('upstreamPage.drawer.metadata.enableTitle')}
          />
        </div>
      </div>

      {canEditConcurrency && concurrencyPolicyPending ? (
        <Skeleton className="h-40 w-full" />
      ) : concurrencyEditable ? (
        <CredentialConcurrencyEditor
          form={form}
          summary={inFlightSummary}
          mutating={mutating}
          onChange={setForm}
        />
      ) : canEditConcurrency ? (
        <div
          role="alert"
          className="border-warning/35 bg-warning/10 text-warning-foreground dark:text-warning rounded-md border px-3 py-2 text-sm leading-5"
        >
          {concurrencyPolicyError
            ? t('credentialsPage.concurrency.policyLoadFailed', {
                message: concurrencyPolicyError,
              })
            : t('credentialsPage.concurrency.contractInvalid')}
        </div>
      ) : null}

      {localError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {localError}
        </div>
      ) : null}
    </form>
  )
}

function QuotaWindowTiming({ window }: { window: QuotaWindow }) {
  const { t } = useTranslation()

  return (
    <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">{t('upstreamPage.quota.window.resetAt')}</dt>
        <dd className="mt-0.5">
          {formatCredentialDateTime(window.resetAt) ?? t('upstreamPage.quota.common.notAvailable')}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t('upstreamPage.quota.window.observedAt')}</dt>
        <dd className="mt-0.5">
          {formatCredentialDateTime(window.observedAt) ??
            t('upstreamPage.quota.common.notAvailable')}
        </dd>
      </div>
    </dl>
  )
}

function QuotaWindowDetailCard({ window }: { window: QuotaWindow }) {
  return (
    <div className="grid gap-3 rounded-md border p-4">
      <InlineWindowBar window={window} />
      <QuotaWindowTiming window={window} />
    </div>
  )
}

function AntigravityQuotaGroups({ groups }: { groups: AntigravityQuotaGroup[] }) {
  const { t } = useTranslation()

  return (
    <div className="overflow-hidden rounded-md border">
      {groups.map((group, groupIndex) => (
        <section key={group.id} className={cn('px-4 py-3.5', groupIndex > 0 && 'border-t')}>
          <h3 className="text-sm font-semibold">
            {t(`upstreamPage.quota.antigravity.${group.id === 'gemini' ? 'gemini' : 'thirdParty'}`)}
          </h3>
          <div className="mt-3 divide-y">
            {group.windows.map((window) => (
              <div key={window.id} className="grid gap-2.5 py-3 first:pt-0 last:pb-0">
                <InlineWindowBar window={window} />
                <QuotaWindowTiming window={window} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function CodexResetCreditsDetail({ resetCredits }: { resetCredits: QuotaResetCredits }) {
  const { t } = useTranslation()
  const unavailableDetailCount = Math.max(
    0,
    resetCredits.availableCount - resetCredits.credits.length,
  )

  return (
    <section className="overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h3 className="text-sm font-semibold">{t('upstreamPage.quota.codex.resetCredits')}</h3>
        <span className="bg-muted/60 text-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums">
          {t('upstreamPage.quota.codex.availableResetCredits', {
            count: resetCredits.availableCount,
          })}
        </span>
      </div>

      {resetCredits.credits.length > 0 ? (
        <div className="divide-y border-t">
          {resetCredits.credits.map((credit, index) => (
            <div
              key={`${credit.grantedAt}-${credit.expiresAt ?? 'no-expiry'}-${index}`}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
            >
              <p className="text-sm font-medium">
                {t('upstreamPage.quota.codex.resetCredit', { index: index + 1 })}
              </p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {t('upstreamPage.quota.codex.expiresAt', {
                  time:
                    formatCredentialDateTime(credit.expiresAt) ??
                    t('upstreamPage.quota.common.notAvailable'),
                })}
              </p>
            </div>
          ))}
        </div>
      ) : resetCredits.availableCount === 0 ? (
        <p className="text-muted-foreground border-t px-4 py-3 text-sm leading-6">
          {t('upstreamPage.quota.codex.noResetCredits')}
        </p>
      ) : null}

      {unavailableDetailCount > 0 ? (
        <p className="text-muted-foreground border-t px-4 py-3 text-sm leading-6">
          {t('upstreamPage.quota.codex.resetCreditDetailsUnavailable', {
            count: unavailableDetailCount,
          })}
        </p>
      ) : null}

      {resetCredits.observedAt ? (
        <p className="text-muted-foreground border-t px-4 py-2 text-xs">
          {t('upstreamPage.quota.codex.observedAt', {
            time:
              formatCredentialDateTime(resetCredits.observedAt) ??
              t('upstreamPage.quota.common.notAvailable'),
          })}
        </p>
      ) : null}
    </section>
  )
}

function GrokQuotaDetail({ entry }: { entry: UpstreamQuotaEntry }) {
  const { t } = useTranslation()
  const monthlyWindow = findCurrencyWindow(entry)
  const onDemandWindow = findXaiOnDemandWindow(entry)

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {entry.plan ? <UpstreamQuotaPlanBadge plan={entry.plan} /> : null}
        <UpstreamQuotaStatusBadge status={entry.status} />
        <UpstreamQuotaMetaBadge>
          {t(`upstreamPage.quota.freshness.${entry.freshness}`)}
        </UpstreamQuotaMetaBadge>
      </div>
      {monthlyWindow ? (
        <div className="grid gap-2 rounded-md border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t('upstreamPage.quota.monthlyCredits')}</p>
            <span className="text-muted-foreground text-xs">
              {formatCredentialDateTime(monthlyWindow.resetAt) ??
                t('upstreamPage.quota.common.notAvailable')}
            </span>
          </div>
          <InlineWindowBar window={monthlyWindow} label={t('upstreamPage.quota.remaining')} />
        </div>
      ) : null}
      <div className="grid gap-2 rounded-md border p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t('upstreamPage.quota.onDemand')}</p>
          <span className="text-muted-foreground text-xs">
            {onDemandWindow
              ? t('upstreamPage.quota.onDemandEnabled')
              : t('upstreamPage.quota.onDemandUnknown')}
          </span>
        </div>
        {onDemandWindow ? (
          <InlineWindowBar window={onDemandWindow} label={t('upstreamPage.quota.remaining')} />
        ) : null}
      </div>
      {entry.windows.length > 0 ? (
        <div className="grid gap-3">
          {entry.windows.map((window) => (
            <QuotaWindowDetailCard key={window.id} window={window} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function UpstreamQuotaDetail({ item }: { item: QuotaCredential }) {
  const { t } = useTranslation()
  const windows = item.windows.length > 0 ? item.windows : item.primaryWindows
  const isAntigravity = item.provider.trim().toLowerCase() === 'antigravity'
  const isCodex = item.provider.trim().toLowerCase() === 'codex'
  const antigravityPresentation = isAntigravity
    ? resolveAntigravityQuotaPresentation(item, windows)
    : null
  const antigravityNeedsRefresh =
    antigravityPresentation?.kind === 'collecting' || antigravityPresentation?.kind === 'legacy'
  const displayStatus = antigravityNeedsRefresh ? 'unknown' : item.status
  const displayFreshness = antigravityNeedsRefresh ? 'stale' : item.freshness

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ProviderLogo providerId={item.provider} size="lg" />
        {item.plan ? <UpstreamQuotaPlanBadge plan={item.plan} /> : null}
        <UpstreamQuotaStatusBadge status={displayStatus} />
        <UpstreamQuotaMetaBadge>
          {t(`upstreamPage.quota.freshness.${displayFreshness}`)}
        </UpstreamQuotaMetaBadge>
        <UpstreamQuotaMetaBadge>
          {t(`upstreamPage.quota.source.${item.source}`)}
        </UpstreamQuotaMetaBadge>
        {isAntigravity && item.collectionStatus !== 'success' ? (
          <UpstreamQuotaMetaBadge>
            {t(`upstreamPage.quota.collection.${item.collectionStatus}`)}
          </UpstreamQuotaMetaBadge>
        ) : null}
      </div>

      {antigravityPresentation?.kind === 'windows' ? (
        <AntigravityQuotaGroups groups={antigravityPresentation.groups} />
      ) : antigravityPresentation ? (
        <p
          className={cn(
            'rounded-md border px-3 py-2.5 text-sm leading-6',
            antigravityPresentation.kind === 'failed'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {antigravityPresentation.kind === 'failed'
            ? (item.lastError?.message ?? t('upstreamPage.quota.collectFailed'))
            : antigravityPresentation.kind === 'collecting'
              ? t('upstreamPage.quota.antigravity.upgrading')
              : antigravityPresentation.kind === 'legacy'
                ? t('upstreamPage.quota.antigravity.legacy')
                : t('upstreamPage.quota.notCollected')}
        </p>
      ) : windows.length > 0 ? (
        <div className="grid gap-3">
          {windows.map((window) => (
            <QuotaWindowDetailCard key={window.id} window={window} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-md border px-3 py-2.5 text-sm">
          {item.lastError?.message ?? t('upstreamPage.quota.detail.noWindowsTitle')}
        </p>
      )}

      {isCodex && item.resetCredits ? (
        <CodexResetCreditsDetail resetCredits={item.resetCredits} />
      ) : null}

      <section>
        <h3 className="text-sm font-semibold">{t('upstreamPage.quota.detail.collection')}</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            [
              t('upstreamPage.quota.detail.collectionStatus'),
              t(`upstreamPage.quota.collection.${item.collectionStatus}`),
            ],
            [t('upstreamPage.quota.detail.source'), t(`upstreamPage.quota.source.${item.source}`)],
            [
              t('upstreamPage.quota.detail.observedAt'),
              formatCredentialDateTime(item.observedAt) ??
                t('upstreamPage.quota.common.notAvailable'),
            ],
            [
              t('upstreamPage.quota.detail.lastAttemptAt'),
              formatCredentialDateTime(item.lastAttemptAt) ??
                t('upstreamPage.quota.common.notAvailable'),
            ],
            [
              t('upstreamPage.quota.detail.nextProbeAt'),
              formatCredentialDateTime(item.nextProbeAt) ??
                t('upstreamPage.quota.common.notAvailable'),
            ],
            [t('upstreamPage.quota.detail.consecutiveFailures'), String(item.consecutiveFailures)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-md border px-3 py-2.5">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="mt-1 min-w-0 truncate text-sm">{value}</dd>
            </div>
          ))}
        </dl>
        {item.lastError ? (
          <div className="border-warning/30 bg-warning/10 mt-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="text-warning-foreground dark:text-warning mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('upstreamPage.quota.detail.lastError')}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-6 break-words">
                  {item.lastError.message}
                </p>
                {item.lastError.code ? (
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {item.lastError.code}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function CredentialQuotaTab({
  resource,
  quotaEntry,
}: {
  resource: CredentialResource
  quotaEntry: UpstreamQuotaEntry | null
}) {
  const { t } = useTranslation()
  const credentialId = quotaEntry?.id ?? resource.authIndex ?? resource.name ?? resource.identifier
  const detail = useUpstreamQuotaCredentialDetail(credentialId)

  if (!detail.available) {
    return (
      <div className="border-info/25 bg-info/10 rounded-md border p-3 text-sm">
        <p className="font-medium">{t('upstreamPage.drawer.quota.unavailableTitle')}</p>
        <p className="text-muted-foreground mt-1 leading-6">
          {t('upstreamPage.drawer.quota.unavailableDescription')}
        </p>
      </div>
    )
  }

  if (detail.isPending) {
    return (
      <div className="grid gap-3" role="status" aria-label={t('upstreamPage.quota.detail.loading')}>
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
    )
  }

  if (detail.isError || !detail.item) {
    return (
      <div className="border-warning/30 bg-warning/10 rounded-md border p-3 text-sm">
        <p className="font-medium">{t('upstreamPage.quota.detail.loadError')}</p>
        <p className="text-muted-foreground mt-1 leading-6 break-words">
          {detail.error?.message ?? t('upstreamPage.quota.common.notAvailable')}
        </p>
      </div>
    )
  }

  const isXai = detail.item.provider.trim().toLowerCase() === 'xai'

  return (
    <div className="grid gap-4">
      {isXai ? <GrokQuotaDetail entry={detail.item} /> : <UpstreamQuotaDetail item={detail.item} />}
      <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs leading-5">
        {t('upstreamPage.drawer.quota.readOnlyNote')}
      </p>
    </div>
  )
}

function ConcurrencyTab({
  resource,
  summary,
  observation,
  observationAvailable,
  summaryPending,
  summaryStale,
  summaryErrorMessage,
}: {
  resource: CredentialResource
  summary: CredentialInFlightSummary | null
  observation: CredentialInFlightObservationMetadata | null
  observationAvailable: boolean
  summaryPending: boolean
  summaryStale: boolean
  summaryErrorMessage: string | null
}) {
  const inFlightCredentialId = getCredentialInFlightId(resource)
  const query = useCredentialInFlightDetail(inFlightCredentialId, observationAvailable)

  return (
    <CredentialConcurrencyDetail
      summary={summary}
      observation={observation}
      observationAvailable={observationAvailable}
      detail={query.detail}
      pending={summaryPending || (observationAvailable && query.isPending)}
      fetching={query.isFetching}
      stale={summaryStale || query.isStale}
      errorMessage={query.errorMessage ?? summaryErrorMessage}
      hasNextPage={query.hasNextPage ?? false}
      fetchingNextPage={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
    />
  )
}

function ModelsTab({
  mutating,
  models,
  onFetchModels,
}: {
  mutating: boolean
  models: Array<{
    id: string
    displayName: string | null
    type: string | null
    ownedBy: string | null
  }> | null
  onFetchModels: () => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3">
      <div className="bg-muted/25 rounded-md border px-3 py-3">
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
          <div className="bg-background/70 mt-3 max-h-96 overflow-y-auto rounded-md border p-2 text-xs">
            {models.length > 0 ? (
              models.slice(0, 50).map((model) => (
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
    </div>
  )
}

function DangerTab({
  mutating,
  onDownload,
  onDelete,
}: {
  mutating: boolean
  onDownload: () => Promise<void>
  onDelete: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3">
      <div className="rounded-md border px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">{t('upstreamPage.drawer.danger.downloadTitle')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('upstreamPage.drawer.danger.downloadDescription')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutating}
            onClick={() => void onDownload()}
          >
            <Download className="size-4" aria-hidden="true" />
            {t('credentialsPage.actions.download')}
          </Button>
        </div>
      </div>
      <div className="border-destructive/35 bg-destructive/5 rounded-md border px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-destructive text-sm font-medium">
              {t('upstreamPage.drawer.danger.deleteTitle')}
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('upstreamPage.drawer.danger.deleteDescription')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:text-destructive"
            disabled={mutating}
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t('credentialsPage.actions.delete')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CredentialDetailDrawer({
  resource,
  tab,
  mutating,
  models,
  quotaEntry,
  showConcurrency,
  observationAvailable,
  canEditConcurrency,
  inFlightSummary,
  inFlightObservation,
  concurrencyPending,
  concurrencyStale,
  concurrencyErrorMessage,
  onTabChange,
  onUpdateMetadata,
  onToggleStatus,
  onFetchModels,
  onDownload,
  onDelete,
}: {
  resource: CredentialResource
  tab: CredentialDrawerTab
  mutating: boolean
  models: Array<{
    id: string
    displayName: string | null
    type: string | null
    ownedBy: string | null
  }> | null
  quotaEntry: UpstreamQuotaEntry | null
  showConcurrency: boolean
  observationAvailable: boolean
  canEditConcurrency: boolean
  inFlightSummary: CredentialInFlightSummary | null
  inFlightObservation: CredentialInFlightObservationMetadata | null
  concurrencyPending: boolean
  concurrencyStale: boolean
  concurrencyErrorMessage: string | null
  onTabChange: (tab: CredentialDrawerTab) => void
  onUpdateMetadata: (input: CredentialMetadataInput) => Promise<void>
  onToggleStatus: () => Promise<void>
  onFetchModels: () => Promise<void>
  onDownload: () => Promise<void>
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const displayName = getCredentialDisplayName(resource)
  const resourceIdentifier = resource.name ?? resource.authIndex ?? resource.identifier
  const concurrencyPolicyQuery = useCredentialConcurrencyPolicy(
    getCredentialInFlightId(resource),
    canEditConcurrency && tab === 'metadata',
  )

  return (
    <>
      <DrawerScaffoldHeader>
        <div className="flex min-w-0 items-start gap-3">
          <ProviderLogo providerId={resource.provider} size="lg" />
          <div className="min-w-0">
            <SheetTitle className="truncate">{displayName}</SheetTitle>
            <SheetDescription className="mt-1 truncate font-mono text-xs">
              {resourceIdentifier} · {getCredentialProviderLabel(t, resource.provider)} ·{' '}
              {resource.type}
            </SheetDescription>
          </div>
        </div>
      </DrawerScaffoldHeader>
      <DrawerTabStrip activeTab={tab} showConcurrency={showConcurrency} onTabChange={onTabChange} />
      <DrawerScaffoldBody>
        {tab === 'overview' ? <OverviewTab resource={resource} quotaEntry={quotaEntry} /> : null}
        {tab === 'metadata' ? (
          <MetadataTab
            resource={resource}
            mutating={mutating}
            canEditConcurrency={canEditConcurrency}
            concurrencyPolicy={concurrencyPolicyQuery.policy}
            concurrencyPolicyPending={concurrencyPolicyQuery.isPending}
            concurrencyPolicyError={concurrencyPolicyQuery.errorMessage}
            inFlightSummary={inFlightSummary}
            onUpdateMetadata={onUpdateMetadata}
            onToggleStatus={onToggleStatus}
          />
        ) : null}
        {tab === 'quota' ? (
          <CredentialQuotaTab resource={resource} quotaEntry={quotaEntry} />
        ) : null}
        {tab === 'concurrency' && showConcurrency ? (
          <ConcurrencyTab
            resource={resource}
            summary={inFlightSummary}
            observation={inFlightObservation}
            observationAvailable={observationAvailable}
            summaryPending={concurrencyPending}
            summaryStale={concurrencyStale}
            summaryErrorMessage={concurrencyErrorMessage}
          />
        ) : null}
        {tab === 'models' ? (
          <ModelsTab mutating={mutating} models={models} onFetchModels={onFetchModels} />
        ) : null}
        {tab === 'danger' ? (
          <DangerTab mutating={mutating} onDownload={onDownload} onDelete={onDelete} />
        ) : null}
      </DrawerScaffoldBody>
      {tab === 'overview' ? (
        <DrawerScaffoldFooter>
          <Button variant="outline" onClick={() => onTabChange('metadata')}>
            {t('upstreamPage.drawer.actions.editMetadata')}
          </Button>
          <Button onClick={() => onTabChange('quota')}>
            <CircleGauge className="size-4" aria-hidden="true" />
            {t('upstreamPage.drawer.actions.viewQuota')}
          </Button>
        </DrawerScaffoldFooter>
      ) : null}
      {tab === 'metadata' ? (
        <DrawerScaffoldFooter>
          <Button variant="outline" disabled={mutating} onClick={() => onTabChange('overview')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="credential-metadata-form" disabled={mutating}>
            {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('credentialsPage.actions.save')}
          </Button>
        </DrawerScaffoldFooter>
      ) : null}
    </>
  )
}
