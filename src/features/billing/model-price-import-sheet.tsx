import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleCheck,
  Download,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DrawerScaffoldBody, DrawerScaffoldFooter } from '@/components/shared/drawer-scaffold'
import { OverflowTooltipText } from '@/components/shared/overflow-tooltip-text'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BillingModelPriceCandidate } from '@/features/billing/use-billing-workbench'
import { ModelPriceImportError } from '@/lib/api/management/billing-model-price-import'
import type {
  BillingServiceTierSource,
  ModelPrice,
  ModelPriceInput,
} from '@/lib/api/management/billing-types'
import {
  createDefaultModelPriceImportPreferences,
  readModelPriceImportPreferences,
  writeModelPriceImportPreferences,
} from '@/lib/billing/model-price-import-preferences'
import { createCompatibilityModelPriceImportPreview } from '@/lib/billing/model-price-import-preview'
import type {
  ModelPriceImportAliasRule,
  ModelPriceImportApplyInput,
  ModelPriceImportApplyItem,
  ModelPriceImportApplyResult,
  ModelPriceImportMatchOverride,
  ModelPriceImportMultiplierRule,
  ModelPriceImportOverwriteMode,
  ModelPriceImportPendingApply,
  ModelPriceImportPolicy,
  ModelPriceImportPreview,
  ModelPriceImportPreviewAction,
  ModelPriceImportPreviewRow,
  ModelPriceImportProgress,
  ModelPriceImportTarget,
  ModelPriceImportTargetFilter,
} from '@/lib/billing/model-price-import-types'
import { type ModelsDevCatalog, fetchModelsDevCatalog } from '@/lib/billing/models-dev-catalog'
import { downloadBlob } from '@/lib/download'
import { cn } from '@/lib/utils'

type Props = {
  candidates: BillingModelPriceCandidate[]
  candidatesLoading: boolean
  candidatesFetching: boolean
  candidatesError: string | null
  candidatesIssue: string | null
  existingPrices: ModelPrice[]
  schemaVersion: number | null
  tierSource: BillingServiceTierSource | null
  entryIntent: 'import' | 'refresh-synced'
  serverEnabled: boolean
  preferenceScope: string
  initialOverwriteMode?: ModelPriceImportOverwriteMode
  initialTargetFilter?: ModelPriceImportTargetFilter
  mutating: boolean
  onCancel: () => void
  onApplyingChange: (applying: boolean) => void
  onRetryCandidates: () => void
  onPreview: (input: {
    targets: ModelPriceImportTarget[]
    overwriteMode: ModelPriceImportOverwriteMode
    policy: ModelPriceImportPolicy
    matchOverrides: ModelPriceImportMatchOverride[]
  }) => Promise<ModelPriceImportPreview>
  onApplyServer: (
    input: ModelPriceImportApplyInput,
    onProgress: (progress: ModelPriceImportProgress) => void,
  ) => Promise<ModelPriceImportApplyResult>
  onApplyCompatibility: (
    items: ModelPriceImportApplyItem[],
    onProgress: (progress: ModelPriceImportProgress) => void,
  ) => Promise<ModelPriceImportApplyResult>
}

type StatusFilter = 'all' | 'applicable' | 'review' | 'skipped'

type SelectionSummary = {
  selected: number
  creates: number
  updatesSync: number
  overwrites: number
  overwritesManual: number
  overwritesDefault: number
  notSelectable: number
  notApplied: number
}

const PENDING_APPLY_PREFIX = 'hmc.billing.model-price-import.pending:'

function formatPrice(value: number | null | undefined, locale: string) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value)
}

function formatReason(t: ReturnType<typeof useTranslation>['t'], row: ModelPriceImportPreviewRow) {
  const reason = row.reasons[0]
  if (!reason) return null
  if (reason.code === 'multiple_matches' && reason.candidates.length > 0) {
    return t('billingPage.prices.import.reasons.multiple_matches_with_candidates', {
      matches: reason.candidates.slice(0, 3).join(', '),
    })
  }
  return t(`billingPage.prices.import.reasons.${reason.code}`, {
    defaultValue: reason.message || reason.code,
  })
}

function summarizeSelection(
  rows: ModelPriceImportPreviewRow[],
  selectedKeys: ReadonlySet<string>,
): SelectionSummary {
  const selected = rows.filter((row) => row.applicable && selectedKeys.has(row.key))
  const overwrites = selected.filter((row) => row.action === 'overwrite')
  return {
    selected: selected.length,
    creates: selected.filter((row) => row.action === 'create').length,
    updatesSync: selected.filter((row) => row.action === 'update_sync').length,
    overwrites: overwrites.length,
    overwritesManual: overwrites.filter((row) => row.existing?.source === 'manual').length,
    overwritesDefault: overwrites.filter((row) => row.existing?.source === 'default').length,
    notSelectable: rows.filter((row) => !row.applicable).length,
    notApplied: rows.length - selected.length,
  }
}

function createId() {
  const cryptoApi = globalThis.crypto
  return cryptoApi && 'randomUUID' in cryptoApi
    ? cryptoApi.randomUUID()
    : `${Date.now()}:${Math.random().toString(16).slice(2)}`
}

function storageKey(scope: string) {
  return `${PENDING_APPLY_PREFIX}${encodeURIComponent(scope)}`
}

function readPendingApply(scope: string): ModelPriceImportPendingApply | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey(scope))
    if (!raw) return null
    const value = JSON.parse(raw) as ModelPriceImportPendingApply
    if (
      value.version !== 1 ||
      typeof value.createdAt !== 'string' ||
      typeof value.input?.previewId !== 'string' ||
      !Array.isArray(value.input.selectedKeys)
    ) {
      window.sessionStorage.removeItem(storageKey(scope))
      return null
    }
    return value
  } catch {
    return null
  }
}

function writePendingApply(scope: string, value: ModelPriceImportPendingApply | null) {
  if (typeof window === 'undefined') return false
  try {
    if (value) window.sessionStorage.setItem(storageKey(scope), JSON.stringify(value))
    else window.sessionStorage.removeItem(storageKey(scope))
    return true
  } catch {
    return false
  }
}

function escapeCsv(value: string | number | boolean | null | undefined) {
  const raw = value == null ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

function normalizeMultiplier(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function downloadCsv(
  filename: string,
  rows: Array<Array<string | number | boolean | null | undefined>>,
) {
  const content = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
  downloadBlob(new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }), filename)
}

function PriceFieldList({
  row,
  locale,
  t,
}: {
  row: ModelPriceImportPreviewRow
  locale: string
  t: ReturnType<typeof useTranslation>['t']
}) {
  if (!row.final) return <span className="text-muted-foreground">—</span>
  const fields = [
    ['input', t('billingPage.prices.import.fields.input'), row.existing?.inputPricePerMillion],
    ['output', t('billingPage.prices.import.fields.output'), row.existing?.outputPricePerMillion],
    [
      'cacheRead',
      t('billingPage.prices.import.fields.cacheRead'),
      row.existing?.cacheReadPricePerMillion,
    ],
    [
      'cacheWrite',
      t('billingPage.prices.import.fields.cacheWrite'),
      row.existing?.cacheWritePricePerMillion,
    ],
    ['request', t('billingPage.prices.import.fields.request'), row.existing?.requestPrice],
  ] as const

  return (
    <div className="grid min-w-[190px] gap-1 text-xs tabular-nums">
      {fields.map(([key, label, previous]) => (
        <div key={key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono">
            {previous == null
              ? formatPrice(row.final?.[key], locale)
              : `${formatPrice(previous, locale)} -> ${formatPrice(row.final?.[key], locale)}`}
          </span>
        </div>
      ))}
    </div>
  )
}

function RuleMetadata({
  row,
  t,
}: {
  row: ModelPriceImportPreviewRow
  t: ReturnType<typeof useTranslation>['t']
}) {
  if (!row.writeRule) return <span className="text-muted-foreground">—</span>
  return (
    <div className="grid min-w-[190px] gap-1 text-xs">
      <span>
        <span className="text-muted-foreground">
          {t('billingPage.prices.import.fields.serviceTier')}{' '}
        </span>
        <span className="font-mono">{row.writeRule.serviceTier}</span>
      </span>
      <span>
        <span className="text-muted-foreground">
          {t('billingPage.prices.import.fields.minInputTokens')}{' '}
        </span>
        <span className="font-mono">{row.writeRule.minInputTokens}</span>
      </span>
      <span>
        <span className="text-muted-foreground">
          {t('billingPage.prices.import.fields.source')}{' '}
        </span>
        {row.writeRule.source}
      </span>
      <span>
        <span className="text-muted-foreground">
          {t('billingPage.prices.import.fields.enabled')}{' '}
        </span>
        {row.writeRule.enabled ? t('billingPage.common.enabled') : t('billingPage.common.disabled')}
      </span>
    </div>
  )
}

function isDefinitiveServerFailure(error: unknown) {
  if (!(error instanceof ModelPriceImportError)) return false
  if (error.code === 'invalid') return error.status === 422
  return ['conflict', 'expired', 'stale', 'unsupported'].includes(error.code)
}

export function ModelPriceImportSheet({
  candidates,
  candidatesLoading,
  candidatesFetching,
  candidatesError,
  candidatesIssue,
  existingPrices,
  schemaVersion,
  tierSource,
  entryIntent,
  serverEnabled,
  preferenceScope,
  initialOverwriteMode,
  initialTargetFilter,
  mutating,
  onCancel,
  onApplyingChange,
  onRetryCandidates,
  onPreview,
  onApplyServer,
  onApplyCompatibility,
}: Props) {
  const { t, i18n } = useTranslation()
  const storedPreferences = useMemo(
    () => readModelPriceImportPreferences(preferenceScope),
    [preferenceScope],
  )
  const defaultPreferences = useMemo(() => createDefaultModelPriceImportPreferences(), [])
  const [policy, setPolicy] = useState<ModelPriceImportPolicy>(storedPreferences.policy)
  const [overwriteMode, setOverwriteMode] = useState<ModelPriceImportOverwriteMode>(
    initialOverwriteMode ?? storedPreferences.overwriteMode,
  )
  const [targetFilter, setTargetFilter] = useState<ModelPriceImportTargetFilter>(
    initialTargetFilter ?? storedPreferences.targetFilter,
  )
  const [providerFilter, setProviderFilter] = useState('all')
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<Set<string>>(new Set())
  const [matchOverrides, setMatchOverrides] = useState<ModelPriceImportMatchOverride[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [catalog, setCatalog] = useState<ModelsDevCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [serverPreview, setServerPreview] = useState<ModelPriceImportPreview | null>(null)
  const [serverPreviewSignature, setServerPreviewSignature] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState<ModelPriceImportProgress | null>(null)
  const [applyResult, setApplyResult] = useState<ModelPriceImportApplyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [overwriteAcknowledged, setOverwriteAcknowledged] = useState(false)
  const [discardPendingOpen, setDiscardPendingOpen] = useState(false)
  const [resetPreferencesOpen, setResetPreferencesOpen] = useState(false)
  const [pendingApply, setPendingApply] = useState<ModelPriceImportPendingApply | null>(() =>
    serverEnabled ? readPendingApply(preferenceScope) : null,
  )
  const [pendingApplyError, setPendingApplyError] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const initialPreviewSignatureRef = useRef<string | null>(null)
  const applyResultRef = useRef<HTMLElement | null>(null)

  const supportsRuleScopes = (schemaVersion ?? 0) >= 2
  const candidatesBusy = candidatesLoading || candidatesFetching
  const effectiveDefaultOverwriteMode = initialOverwriteMode ?? defaultPreferences.overwriteMode
  const effectiveDefaultTargetFilter = initialTargetFilter ?? defaultPreferences.targetFilter
  const advancedPolicyModified = useMemo(
    () =>
      JSON.stringify({
        rules: policy.rules,
        aliases: policy.aliases,
        rowMultipliers: policy.rowMultipliers,
        includeCachePrices: policy.includeCachePrices,
        includeZeroCost: policy.includeZeroCost,
      }) !==
      JSON.stringify({
        rules: defaultPreferences.policy.rules,
        aliases: defaultPreferences.policy.aliases,
        rowMultipliers: defaultPreferences.policy.rowMultipliers,
        includeCachePrices: defaultPreferences.policy.includeCachePrices,
        includeZeroCost: defaultPreferences.policy.includeZeroCost,
      }),
    [defaultPreferences.policy, policy],
  )
  const importPreferencesModified =
    advancedPolicyModified ||
    policy.defaultMultiplier !== defaultPreferences.policy.defaultMultiplier ||
    overwriteMode !== effectiveDefaultOverwriteMode ||
    targetFilter !== effectiveDefaultTargetFilter
  const advancedPolicySummary = t('billingPage.prices.import.advancedPolicySummary', {
    rules: policy.rules.length,
    aliases: policy.aliases.length,
    rowOverrides: Object.keys(policy.rowMultipliers).length,
    cache: policy.includeCachePrices
      ? t('billingPage.prices.import.cachePricesIncluded')
      : t('billingPage.prices.import.cachePricesExcluded'),
    zero: policy.includeZeroCost
      ? t('billingPage.prices.import.zeroCostIncluded')
      : t('billingPage.prices.import.zeroCostExcluded'),
  })
  const overwriteModeLabel =
    overwriteMode === 'missing'
      ? t('billingPage.prices.import.overwriteMissing')
      : overwriteMode === 'sync'
        ? t('billingPage.prices.import.overwriteSync')
        : t('billingPage.prices.import.overwriteAll')

  useEffect(() => {
    writeModelPriceImportPreferences(preferenceScope, {
      policy,
      overwriteMode: entryIntent === 'import' ? overwriteMode : storedPreferences.overwriteMode,
      targetFilter: entryIntent === 'import' ? targetFilter : storedPreferences.targetFilter,
    })
  }, [entryIntent, overwriteMode, policy, preferenceScope, storedPreferences, targetFilter])

  useEffect(() => {
    onApplyingChange(applying)
    return () => onApplyingChange(false)
  }, [applying, onApplyingChange])

  useEffect(() => {
    if (!applyResult) return
    applyResultRef.current?.scrollIntoView({ block: 'nearest' })
  }, [applyResult])

  useEffect(() => {
    if (!applying) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [applying])

  const baseExistingByTarget = useMemo(
    () =>
      new Map(
        existingPrices
          .filter((price) => price.serviceTier === '*' && price.minInputTokens === 0)
          .map((price) => [`${price.provider.toLowerCase()}::${price.model.toLowerCase()}`, price]),
      ),
    [existingPrices],
  )

  const providers = useMemo(
    () => [...new Set(candidates.map((candidate) => candidate.provider))].sort(),
    [candidates],
  )

  const targets = useMemo<ModelPriceImportTarget[]>(() => {
    return candidates
      .filter((candidate) => providerFilter === 'all' || candidate.provider === providerFilter)
      .filter((candidate) => {
        const key = `${candidate.provider.toLowerCase()}::${candidate.model.toLowerCase()}`
        const existing = baseExistingByTarget.get(key)
        if (targetFilter === 'missing') return !existing
        if (targetFilter === 'synced') return existing?.source === 'sync'
        if (targetFilter === 'selected') return selectedTargetKeys.has(candidate.id)
        return true
      })
      .map((candidate) => ({
        provider: candidate.provider,
        model: candidate.model,
        label: candidate.label,
        scopes: candidate.scopes,
      }))
  }, [baseExistingByTarget, candidates, providerFilter, selectedTargetKeys, targetFilter])

  const previewInput = useMemo(
    () => ({ targets, overwriteMode, policy, matchOverrides }),
    [matchOverrides, overwriteMode, policy, targets],
  )
  const previewSignature = useMemo(() => JSON.stringify(previewInput), [previewInput])

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      setCatalog(await fetchModelsDevCatalog())
    } catch (loadError) {
      setCatalog(null)
      setCatalogError(
        loadError instanceof Error
          ? loadError.message
          : t('billingPage.prices.import.catalogFailed'),
      )
    } finally {
      setCatalogLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!serverEnabled) void loadCatalog()
  }, [loadCatalog, serverEnabled])

  const compatibilityPreview = useMemo(() => {
    if (serverEnabled || !catalog || targets.length === 0) return null
    return createCompatibilityModelPriceImportPreview({
      catalog,
      targets,
      existingPrices,
      policy,
      overwriteMode,
      matchOverrides,
      generatedAt: catalog.fetchedAt,
    })
  }, [catalog, existingPrices, matchOverrides, serverEnabled, overwriteMode, policy, targets])

  const requestServerPreview = useCallback(
    async (preferredSelection?: string[]) => {
      if (!serverEnabled || previewInput.targets.length === 0 || pendingApply) return
      setPreviewLoading(true)
      setPreviewError(null)
      setError(null)
      try {
        const next = await onPreview(previewInput)
        setServerPreview(next)
        setServerPreviewSignature(previewSignature)
        setApplyResult(null)
        setSelectedKeys(
          new Set(
            next.rows
              .filter(
                (row) =>
                  row.applicable &&
                  (preferredSelection
                    ? preferredSelection.includes(row.key)
                    : row.selectedByDefault && row.action !== 'overwrite'),
              )
              .map((row) => row.key),
          ),
        )
      } catch (previewFailure) {
        setPreviewError(
          previewFailure instanceof Error
            ? previewFailure.message
            : t('billingPage.prices.import.serverPreviewFailed'),
        )
      } finally {
        setPreviewLoading(false)
      }
    },
    [serverEnabled, onPreview, pendingApply, previewInput, previewSignature, t],
  )

  useEffect(() => {
    if (
      !serverEnabled ||
      candidatesBusy ||
      candidatesError ||
      targets.length === 0 ||
      pendingApply ||
      initialPreviewSignatureRef.current === previewSignature
    ) {
      return
    }
    initialPreviewSignatureRef.current = previewSignature
    void requestServerPreview()
  }, [
    candidatesBusy,
    candidatesError,
    serverEnabled,
    pendingApply,
    previewSignature,
    requestServerPreview,
    targets.length,
  ])

  const preview = serverEnabled ? serverPreview : compatibilityPreview
  const previewStale =
    serverEnabled && Boolean(preview) && serverPreviewSignature !== previewSignature
  const previewExpired = Boolean(
    preview?.expiresAt && new Date(preview.expiresAt).getTime() <= clock,
  )

  useEffect(() => {
    if (!preview?.expiresAt) return
    const delay = Math.max(0, new Date(preview.expiresAt).getTime() - Date.now())
    const timeout = window.setTimeout(() => setClock(Date.now()), delay + 50)
    return () => window.clearTimeout(timeout)
  }, [preview?.expiresAt])

  const rows = useMemo(() => preview?.rows ?? [], [preview])
  const previewSelectionKey = serverEnabled
    ? `${preview?.id ?? 'none'}:${preview?.revision ?? 'none'}`
    : previewSignature

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedKeys(new Set())
      return
    }
    setSelectedKeys((current) => {
      const allowed = new Set(rows.filter((row) => row.applicable).map((row) => row.key))
      const preserved = new Set([...current].filter((key) => allowed.has(key)))
      if (preserved.size > 0) return preserved
      return new Set(
        rows
          .filter((row) => row.applicable && row.selectedByDefault && row.action !== 'overwrite')
          .map((row) => row.key),
      )
    })
  }, [previewSelectionKey, rows])

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === 'applicable' && !row.applicable) return false
      if (
        statusFilter === 'review' &&
        !['ambiguous', 'unmatched', 'conflict', 'invalid', 'unsupported'].includes(row.status) &&
        !(row.status === 'zero_cost' && !row.applicable)
      ) {
        return false
      }
      if (statusFilter === 'skipped' && row.applicable) return false
      if (!normalized) return true
      return [row.provider, row.model, row.label, row.matchedProvider, row.matchedModel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    })
  }, [rows, search, statusFilter])

  const selectedRows = useMemo(
    () => rows.filter((row) => row.applicable && selectedKeys.has(row.key)),
    [rows, selectedKeys],
  )
  const selectedSummary = useMemo(
    () => summarizeSelection(rows, selectedKeys),
    [rows, selectedKeys],
  )
  const potentialSummary = useMemo(
    () =>
      summarizeSelection(rows, new Set(rows.filter((row) => row.applicable).map((row) => row.key))),
    [rows],
  )

  const busy = mutating || applying || previewLoading || catalogLoading || candidatesBusy
  const applyBlocked =
    previewStale ||
    previewExpired ||
    Boolean(previewError) ||
    Boolean(catalogError) ||
    Boolean(pendingApply)

  const toggleRow = (row: ModelPriceImportPreviewRow, checked: boolean) => {
    if (!row.applicable || applyBlocked) return
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (checked) next.add(row.key)
      else next.delete(row.key)
      return next
    })
  }

  const setRowMultiplier = (row: ModelPriceImportPreviewRow, multiplier: number) => {
    setPolicy((current) => ({
      ...current,
      rowMultipliers: {
        ...current.rowMultipliers,
        [row.key]: normalizeMultiplier(multiplier),
      },
    }))
  }

  const setMatchOverride = (row: ModelPriceImportPreviewRow, candidate: string) => {
    const separator = candidate.indexOf('/')
    if (separator <= 0) return
    setMatchOverrides((current) => [
      ...current.filter(
        (item) => item.targetProvider !== row.provider || item.targetModel !== row.model,
      ),
      {
        targetProvider: row.provider,
        targetModel: row.model,
        sourceProvider: candidate.slice(0, separator),
        sourceModel: candidate.slice(separator + 1),
      },
    ])
  }

  const updateRule = (id: string, patch: Partial<ModelPriceImportMultiplierRule>) => {
    setPolicy((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    }))
  }

  const moveRule = (index: number, direction: -1 | 1) => {
    setPolicy((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.rules.length) return current
      const rules = [...current.rules]
      const [rule] = rules.splice(index, 1)
      rules.splice(nextIndex, 0, rule)
      return { ...current, rules }
    })
  }

  const updateAlias = (id: string, patch: Partial<ModelPriceImportAliasRule>) => {
    setPolicy((current) => ({
      ...current,
      aliases: current.aliases.map((alias) => (alias.id === id ? { ...alias, ...patch } : alias)),
    }))
  }

  const exportPreview = () => {
    if (!preview) return
    downloadCsv(`model-price-import-preview-${preview.id.replaceAll(':', '-')}.csv`, [
      [
        'preview_id',
        'mode',
        'provider',
        'model',
        'status',
        'action',
        'selected',
        'source_model',
        'multiplier',
        'input',
        'output',
        'cache_read',
        'cache_write',
        'request',
        'existing_source',
        'reason',
      ],
      ...rows.map((row) => [
        preview.id,
        preview.mode,
        row.provider,
        row.model,
        row.status,
        row.action,
        selectedKeys.has(row.key),
        row.matchedProvider && row.matchedModel ? `${row.matchedProvider}/${row.matchedModel}` : '',
        row.multiplier,
        row.final?.input,
        row.final?.output,
        row.final?.cacheRead,
        row.final?.cacheWrite,
        row.final?.request,
        row.existing?.source,
        row.reasons[0]?.message || row.reasons[0]?.code,
      ]),
    ])
  }

  const exportResult = () => {
    if (!applyResult) return
    downloadCsv(`model-price-import-result-${applyResult.operationId.replaceAll(':', '-')}.csv`, [
      ['operation_id', 'provider', 'model', 'action', 'status', 'resource_id', 'error'],
      ...applyResult.rows.map((row) => [
        applyResult.operationId,
        row.provider,
        row.model,
        row.action,
        row.status,
        row.resourceId,
        row.errorMessage || row.errorCode,
      ]),
    ])
  }

  const finishApply = (result: ModelPriceImportApplyResult) => {
    setApplyResult(result)
    const applied = result.summary.creates + result.summary.updatesSync + result.summary.overwrites
    if (result.status === 'applied') {
      toast.success(t('billingPage.prices.import.applied', { count: applied }))
    } else {
      toast.warning(
        t('billingPage.prices.import.result.partial.description', {
          created: result.summary.creates,
          updated: result.summary.updatesSync,
          overwritten: result.summary.overwrites,
          failed: result.summary.failed + result.summary.conflicts,
        }),
      )
    }
  }

  const submitServerApply = async (input: ModelPriceImportApplyInput) => {
    setApplying(true)
    setProgress({ completed: 0, total: input.selectedKeys.length, currentModel: null })
    setPendingApplyError(null)
    setError(null)
    try {
      const result = await onApplyServer(input, setProgress)
      writePendingApply(preferenceScope, null)
      setPendingApply(null)
      setProgress({
        completed: input.selectedKeys.length,
        total: input.selectedKeys.length,
        currentModel: null,
      })
      finishApply(result)
    } catch (applyError) {
      if (isDefinitiveServerFailure(applyError)) {
        writePendingApply(preferenceScope, null)
        setPendingApply(null)
        setError(
          applyError instanceof Error ? applyError.message : t('billingPage.toast.actionFailed'),
        )
      } else {
        setPendingApplyError(
          applyError instanceof Error
            ? applyError.message
            : t('billingPage.prices.import.recovery.unknownError'),
        )
      }
    } finally {
      setApplying(false)
      setConfirmOpen(false)
    }
  }

  const handleApply = async () => {
    if (!preview || selectedRows.length === 0) {
      setError(t('billingPage.prices.import.validation.selectRows'))
      return
    }
    if (applyBlocked) {
      setError(t('billingPage.prices.import.validation.refreshPreview'))
      return
    }

    setError(null)
    setApplyResult(null)
    if (serverEnabled) {
      const input: ModelPriceImportApplyInput = {
        previewId: preview.id,
        previewRevision: preview.revision,
        selectedKeys: selectedRows.map((row) => row.key),
        confirmOverwrite: selectedSummary.overwrites > 0,
        idempotencyKey: `model-price-import:${preview.id}:${createId()}`,
        expectedAtomic: preview.atomic,
        expectedRows: selectedRows.map((row) => ({
          key: row.key,
          provider: row.provider,
          model: row.model,
          action: row.action as Extract<
            ModelPriceImportPreviewAction,
            'create' | 'update_sync' | 'overwrite'
          >,
        })),
      }
      const pending: ModelPriceImportPendingApply = {
        version: 1,
        createdAt: new Date().toISOString(),
        input,
      }
      if (!writePendingApply(preferenceScope, pending)) {
        setError(t('billingPage.prices.import.recovery.storageFailed'))
        return
      }
      setPendingApply(pending)
      await submitServerApply(input)
      return
    }

    const items: ModelPriceImportApplyItem[] = []
    for (const row of selectedRows) {
      if (!row.final || !row.writeRule) continue
      const resource = row.existing
        ? existingPrices.find((price) => price.id === row.existing?.id)
        : undefined
      if (row.existing && !resource) {
        setError(t('billingPage.prices.import.validation.existingRuleMissing'))
        return
      }
      const input: ModelPriceInput = {
        provider: row.provider,
        model: row.model,
        ...(supportsRuleScopes
          ? {
              serviceTier: row.writeRule.serviceTier,
              minInputTokens: row.writeRule.minInputTokens,
            }
          : {}),
        inputPricePerMillion: row.final.input,
        outputPricePerMillion: row.final.output,
        cacheReadPricePerMillion: row.final.cacheRead,
        cacheWritePricePerMillion: row.final.cacheWrite,
        requestPrice: row.final.request,
        enabled: row.writeRule.enabled,
        source: 'sync',
        note: row.writeRule.note ?? undefined,
      }
      items.push({
        key: row.key,
        action: row.action as Extract<
          ModelPriceImportPreviewAction,
          'create' | 'update_sync' | 'overwrite'
        >,
        mode: resource ? 'update' : 'create',
        resource,
        input,
      })
    }

    setApplying(true)
    setProgress({ completed: 0, total: items.length, currentModel: null })
    try {
      finishApply(await onApplyCompatibility(items, setProgress))
    } catch (applyError) {
      setError(
        applyError instanceof Error ? applyError.message : t('billingPage.toast.actionFailed'),
      )
    } finally {
      setApplying(false)
      setConfirmOpen(false)
    }
  }

  const retryPendingApply = () => {
    if (pendingApply && !applying) void submitServerApply(pendingApply.input)
  }

  const retryFailedRows = () => {
    if (!applyResult) return
    const keys = applyResult.rows
      .filter((row) => row.status === 'failed' || row.status === 'conflict')
      .map((row) => row.key)
    setApplyResult(null)
    setSelectedKeys(new Set(keys))
    if (serverEnabled) void requestServerPreview(keys)
    else void loadCatalog()
  }

  const resetPreferences = () => {
    setPolicy(defaultPreferences.policy)
    setOverwriteMode(effectiveDefaultOverwriteMode)
    setTargetFilter(effectiveDefaultTargetFilter)
    setResetPreferencesOpen(false)
    toast.success(t('billingPage.prices.import.resetPreferencesSuccess'))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DrawerScaffoldBody className="grid gap-5 p-4 sm:p-5">
        {pendingApply && !applying ? (
          <section
            role="status"
            aria-live="polite"
            className="border-warning/40 bg-warning/10 grid gap-3 rounded-md border px-3 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">
                  {t('billingPage.prices.import.recovery.title')}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {t('billingPage.prices.import.recovery.description', {
                    count: pendingApply.input.selectedKeys.length,
                  })}
                </p>
              </div>
            </div>
            {pendingApplyError ? (
              <p className="text-destructive text-xs">{pendingApplyError}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={applying} onClick={retryPendingApply}>
                {applying ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                {t('billingPage.prices.import.recovery.retry')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={applying}
                onClick={() => setDiscardPendingOpen(true)}
              >
                {t('billingPage.prices.import.recovery.discard')}
              </Button>
            </div>
          </section>
        ) : null}

        <div className="border-info/30 bg-info/10 text-info rounded-md border px-3 py-2 text-xs leading-5">
          <div className="flex items-start gap-2">
            {entryIntent === 'refresh-synced' ? (
              <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0 text-pretty">
              {entryIntent === 'refresh-synced' ? (
                <>
                  <p className="font-medium">{t('billingPage.prices.import.refreshPresetTitle')}</p>
                  <p className="mt-0.5">{t('billingPage.prices.import.refreshPresetHint')}</p>
                </>
              ) : (
                t('billingPage.prices.import.manualConfirmHint')
              )}
            </div>
          </div>
        </div>

        {!serverEnabled ? (
          <div className="border-warning/30 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs leading-5">
            {t('billingPage.prices.import.legacyPreviewWarning')}
          </div>
        ) : null}

        {candidatesError || candidatesIssue ? (
          <section
            className={cn(
              'rounded-md border px-3 py-3 text-xs leading-5',
              candidatesError
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-warning/30 bg-warning/10 text-warning',
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {candidatesError
                    ? t('billingPage.prices.import.candidateErrorTitle')
                    : t('billingPage.prices.import.candidateIssueTitle')}
                </p>
                <p className="mt-1 break-words whitespace-pre-line">
                  {candidatesError || candidatesIssue}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onRetryCandidates}
              >
                {candidatesBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                {t('billingPage.prices.import.reloadCandidates')}
              </Button>
            </div>
          </section>
        ) : null}

        {supportsRuleScopes ? (
          <section className="border-info/30 bg-info/5 grid gap-2 rounded-md border px-3 py-3">
            <div className="flex items-start gap-2">
              <Route className="text-info mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    {t('billingPage.prices.import.runtimeContextTitle')}
                  </h3>
                  <span className="bg-info/10 text-info rounded px-1.5 py-0.5 text-[11px] font-medium">
                    {t(`billingPage.settings.${tierSource ?? 'request'}`)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {t('billingPage.prices.import.runtimeContextChain', {
                    source: t(`billingPage.settings.${tierSource ?? 'request'}`),
                  })}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 border-b pb-5">
          <div>
            <h3 className="text-sm font-semibold">{t('billingPage.prices.import.targetsTitle')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('billingPage.prices.import.targetsHint')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">
                {t('billingPage.prices.import.providerFilter')}
              </span>
              <Select value={providerFilter} onValueChange={setProviderFilter} disabled={busy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('billingPage.prices.import.allProviders')}</SelectItem>
                  {providers.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">
                {t('billingPage.prices.import.targetFilter')}
              </span>
              {entryIntent === 'refresh-synced' ? (
                <div className="bg-muted/35 flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                  <RefreshCw
                    className="text-muted-foreground size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">
                    {t('billingPage.prices.import.targetFilters.synced')}
                  </span>
                </div>
              ) : (
                <Select
                  value={targetFilter}
                  onValueChange={(value) => setTargetFilter(value as ModelPriceImportTargetFilter)}
                  disabled={busy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('billingPage.prices.import.targetFilters.all')}
                    </SelectItem>
                    <SelectItem value="missing">
                      {t('billingPage.prices.import.targetFilters.missing')}
                    </SelectItem>
                    <SelectItem value="synced">
                      {t('billingPage.prices.import.targetFilters.synced')}
                    </SelectItem>
                    <SelectItem value="selected">
                      {t('billingPage.prices.import.targetFilters.selected')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          {targetFilter === 'selected' ? (
            <div className="max-h-44 overflow-y-auto rounded-md border p-2">
              <div className="grid gap-1 sm:grid-cols-2">
                {candidates
                  .filter(
                    (candidate) =>
                      providerFilter === 'all' || candidate.provider === providerFilter,
                  )
                  .map((candidate) => (
                    <label
                      key={candidate.id}
                      className="hover:bg-muted/50 flex min-h-9 items-center gap-2 rounded px-2 text-xs"
                    >
                      <Checkbox
                        checked={selectedTargetKeys.has(candidate.id)}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setSelectedTargetKeys((current) => {
                            const next = new Set(current)
                            if (checked === true) next.add(candidate.id)
                            else next.delete(candidate.id)
                            return next
                          })
                        }
                      />
                      <span className="min-w-0 truncate font-mono">{candidate.model}</span>
                    </label>
                  ))}
              </div>
            </div>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {t('billingPage.prices.import.targetsCount', { count: targets.length })}
          </p>
        </section>

        <section className="grid gap-3 border-b pb-5">
          <div>
            <h3 className="text-sm font-semibold">{t('billingPage.prices.import.policyTitle')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('billingPage.prices.import.policyHint')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">
                {t('billingPage.prices.import.defaultMultiplier')}
              </span>
              <Input
                type="number"
                min="0.01"
                step="0.1"
                value={policy.defaultMultiplier}
                disabled={busy}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    defaultMultiplier: normalizeMultiplier(Number(event.target.value)),
                  }))
                }
              />
            </label>
            <div className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">
                {t('billingPage.prices.import.overwriteMode')}
              </span>
              {entryIntent === 'refresh-synced' ? (
                <div className="bg-muted/35 flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                  <RefreshCw
                    className="text-muted-foreground size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">
                    {t('billingPage.prices.import.refreshApplyMode')}
                  </span>
                </div>
              ) : (
                <Select
                  value={overwriteMode}
                  onValueChange={(value) =>
                    setOverwriteMode(value as ModelPriceImportOverwriteMode)
                  }
                  disabled={busy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="missing">
                      {t('billingPage.prices.import.overwriteMissing')}
                    </SelectItem>
                    <SelectItem value="sync">
                      {t('billingPage.prices.import.overwriteSync')}
                    </SelectItem>
                    <SelectItem value="all">
                      {t('billingPage.prices.import.overwriteAll')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          {overwriteMode === 'all' && potentialSummary.overwrites > 0 ? (
            <p className="border-warning/30 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs leading-5">
              {t('billingPage.prices.import.overwriteWarning', {
                count: potentialSummary.overwrites,
              })}
            </p>
          ) : null}
          <Collapsible
            open={advancedOpen}
            onOpenChange={setAdvancedOpen}
            className={cn(
              'overflow-hidden rounded-md border transition-colors',
              advancedOpen
                ? 'border-primary/30 bg-primary/[0.02]'
                : 'border-border/80 bg-muted/20 border-dashed',
            )}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                disabled={busy}
                className="hover:bg-primary/5 focus-visible:ring-ring grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="grid min-w-0 gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {advancedOpen
                      ? t('billingPage.prices.import.hideAdvancedPolicy')
                      : t('billingPage.prices.import.showAdvancedPolicy')}
                    {advancedPolicyModified ? (
                      <span className="bg-info/10 text-info rounded px-1.5 py-0.5 text-[11px] font-medium">
                        {t('billingPage.prices.import.modifiedBadge')}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs leading-5">
                    {advancedPolicySummary}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    'text-primary size-5 shrink-0 transition-transform',
                    advancedOpen && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="bg-background border-t">
              <div className="grid gap-5 p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-muted-foreground max-w-2xl text-xs leading-5">
                    {t('billingPage.prices.import.advancedPolicyHint')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={busy || !importPreferencesModified}
                    onClick={() => setResetPreferencesOpen(true)}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t('billingPage.prices.import.restoreDefaults')}
                  </Button>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold">
                      {t('billingPage.prices.import.multiplierRulesTitle')}
                    </h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setPolicy((current) => ({
                          ...current,
                          rules: [
                            ...current.rules,
                            {
                              id: createId(),
                              label: '',
                              matchMode: 'prefix',
                              pattern: '',
                              multiplier: 1,
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {t('billingPage.prices.import.addRule')}
                    </Button>
                  </div>
                  {policy.rules.map((rule, index) => (
                    <div
                      key={rule.id}
                      className="grid gap-2 rounded-md border p-2 sm:grid-cols-[8rem_7rem_minmax(9rem,1fr)_7rem_auto] sm:items-end"
                    >
                      <label className="grid gap-1 text-xs">
                        <span className="text-muted-foreground">
                          {t('billingPage.prices.import.ruleLabel')}
                        </span>
                        <Input
                          value={rule.label}
                          disabled={busy}
                          onChange={(event) => updateRule(rule.id, { label: event.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="text-muted-foreground">
                          {t('billingPage.prices.import.ruleMode')}
                        </span>
                        <Select
                          value={rule.matchMode}
                          onValueChange={(value) =>
                            updateRule(rule.id, { matchMode: value as 'prefix' | 'regex' })
                          }
                          disabled={busy}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="prefix">
                              {t('billingPage.prices.import.ruleModes.prefix')}
                            </SelectItem>
                            <SelectItem value="regex">
                              {t('billingPage.prices.import.ruleModes.regex')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="text-muted-foreground">
                          {t('billingPage.prices.import.rulePattern')}
                        </span>
                        <Input
                          value={rule.pattern}
                          disabled={busy}
                          onChange={(event) => updateRule(rule.id, { pattern: event.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="text-muted-foreground">
                          {t('billingPage.prices.import.ruleMultiplier')}
                        </span>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.1"
                          value={rule.multiplier}
                          disabled={busy}
                          onChange={(event) =>
                            updateRule(rule.id, {
                              multiplier: normalizeMultiplier(Number(event.target.value)),
                            })
                          }
                        />
                      </label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={t('billingPage.prices.import.moveRuleUp')}
                          disabled={busy || index === 0}
                          onClick={() => moveRule(index, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={t('billingPage.prices.import.moveRuleDown')}
                          disabled={busy || index === policy.rules.length - 1}
                          onClick={() => moveRule(index, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={t('billingPage.prices.import.removeRule')}
                          disabled={busy}
                          onClick={() =>
                            setPolicy((current) => ({
                              ...current,
                              rules: current.rules.filter((item) => item.id !== rule.id),
                            }))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold">
                      {t('billingPage.prices.import.aliasRulesTitle')}
                    </h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setPolicy((current) => ({
                          ...current,
                          aliases: [
                            ...current.aliases,
                            { id: createId(), targetModel: '', sourceModels: [] },
                          ],
                        }))
                      }
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {t('billingPage.prices.import.addAlias')}
                    </Button>
                  </div>
                  <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                    {policy.aliases.map((alias) => (
                      <div
                        key={alias.id}
                        className="grid gap-2 rounded-md border p-2 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(14rem,1.2fr)_auto] sm:items-end"
                      >
                        <label className="grid gap-1 text-xs">
                          <span className="text-muted-foreground">
                            {t('billingPage.prices.import.aliasTarget')}
                          </span>
                          <Input
                            value={alias.targetModel}
                            disabled={busy}
                            onChange={(event) =>
                              updateAlias(alias.id, { targetModel: event.target.value })
                            }
                          />
                        </label>
                        <label className="grid gap-1 text-xs">
                          <span className="text-muted-foreground">
                            {t('billingPage.prices.import.aliasSources')}
                          </span>
                          <Input
                            value={alias.sourceModels.join(', ')}
                            disabled={busy}
                            onChange={(event) =>
                              updateAlias(alias.id, {
                                sourceModels: event.target.value
                                  .split(',')
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={t('billingPage.prices.import.removeAlias')}
                          disabled={busy}
                          onClick={() =>
                            setPolicy((current) => ({
                              ...current,
                              aliases: current.aliases.filter((item) => item.id !== alias.id),
                            }))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex min-h-9 items-center gap-2">
                    <Checkbox
                      checked={policy.includeCachePrices}
                      disabled={busy}
                      onCheckedChange={(checked) =>
                        setPolicy((current) => ({
                          ...current,
                          includeCachePrices: checked === true,
                        }))
                      }
                    />
                    <span>{t('billingPage.prices.import.includeCache')}</span>
                  </label>
                  <label className="flex min-h-9 items-center gap-2">
                    <Checkbox
                      checked={policy.includeZeroCost}
                      disabled={busy}
                      onCheckedChange={(checked) =>
                        setPolicy((current) => ({ ...current, includeZeroCost: checked === true }))
                      }
                    />
                    <span>{t('billingPage.prices.import.includeZeroCost')}</span>
                  </label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        <section className="grid gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">
                  {t('billingPage.prices.import.previewTitle')}
                </h3>
                {preview ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      'bg-info/10 text-info',
                    )}
                  >
                    {serverEnabled
                      ? t('billingPage.prices.import.serverPreviewBadge')
                      : t('billingPage.prices.import.legacyPreviewBadge')}
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {t('billingPage.prices.import.previewHint', {
                  selected: selectedRows.length,
                  selectable: rows.filter((row) => row.applicable).length,
                  total: rows.length,
                })}
              </p>
              {preview ? (
                <p className="text-muted-foreground mt-1 text-[11px]">
                  {t('billingPage.prices.import.catalogReady', {
                    count: preview.sourceModelCount,
                    time: new Date(preview.sourceFetchedAt).toLocaleString(i18n.language),
                  })}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!preview}
                onClick={exportPreview}
              >
                <Download className="size-4" />
                {t('billingPage.prices.import.exportPreview')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || targets.length === 0}
                onClick={() =>
                  void (serverEnabled ? requestServerPreview([...selectedKeys]) : loadCatalog())
                }
              >
                {previewLoading || catalogLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t('billingPage.prices.import.refreshServerPreview')}
              </Button>
            </div>
          </div>

          <div className="bg-muted/25 grid gap-3 rounded-md border px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs font-semibold">
                {t('billingPage.prices.import.previewPolicySummaryTitle')}
              </h4>
              {importPreferencesModified ? (
                <span className="bg-info/10 text-info rounded px-1.5 py-0.5 text-[11px] font-medium">
                  {t('billingPage.prices.import.modifiedBadge')}
                </span>
              ) : null}
            </div>
            <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">
                  {t('billingPage.prices.import.runtimeContextTitle')}
                </dt>
                <dd className="font-medium">
                  {t(`billingPage.settings.${tierSource ?? 'request'}`)}
                </dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">
                  {t('billingPage.prices.import.defaultMultiplier')}
                </dt>
                <dd className="font-medium tabular-nums">{policy.defaultMultiplier}</dd>
              </div>
              <div className="grid gap-0.5 sm:col-span-2">
                <dt className="text-muted-foreground">
                  {t('billingPage.prices.import.overwriteMode')}
                </dt>
                <dd className="font-medium">{overwriteModeLabel}</dd>
              </div>
              <div className="grid gap-0.5 sm:col-span-2">
                <dt className="text-muted-foreground">
                  {t('billingPage.prices.import.advancedPolicy')}
                </dt>
                <dd className="font-medium">{advancedPolicySummary}</dd>
              </div>
            </dl>
          </div>

          {previewStale ? (
            <p className="border-warning/30 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs">
              {t('billingPage.prices.import.previewInvalid.stale')}
            </p>
          ) : null}
          {previewExpired ? (
            <p className="border-warning/30 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs">
              {t('billingPage.prices.import.previewInvalid.expired')}
            </p>
          ) : null}
          {previewError || catalogError ? (
            <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
              {previewError || catalogError}
            </p>
          ) : null}
          {preview?.issues.length ? (
            <div
              className="border-warning/30 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs"
              role="status"
            >
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {t('billingPage.prices.import.serverIssuesTitle')}
              </div>
              <ul className="mt-1 grid gap-1 pl-6">
                {preview.issues.map((issue, index) => (
                  <li key={`${issue.code}:${index}`} className="leading-5">
                    {t(`billingPage.prices.import.reasons.${issue.code}`, {
                      defaultValue: issue.message || issue.code,
                    })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y py-3 text-xs sm:grid-cols-5">
            {[
              [t('billingPage.prices.import.summaryCreates'), selectedSummary.creates],
              [t('billingPage.prices.import.summaryUpdatesSync'), selectedSummary.updatesSync],
              [t('billingPage.prices.import.summaryOverwrites'), selectedSummary.overwrites],
              [t('billingPage.prices.import.summaryNotSelectable'), selectedSummary.notSelectable],
              [t('billingPage.prices.import.summaryNotApplied'), selectedSummary.notApplied],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {selectedSummary.overwrites > 0 ? (
            <p className="text-warning text-xs leading-5">
              {t('billingPage.prices.import.selectedOverwriteWarning', {
                manual: selectedSummary.overwritesManual,
                default: selectedSummary.overwritesDefault,
              })}
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto_auto]">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                value={search}
                disabled={busy}
                placeholder={t('billingPage.prices.import.searchPlaceholder')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              disabled={busy}
            >
              <SelectTrigger aria-label={t('billingPage.prices.import.statusFilter.label')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('billingPage.prices.import.statusFilter.all')}
                </SelectItem>
                <SelectItem value="applicable">
                  {t('billingPage.prices.import.statusFilter.applicable')}
                </SelectItem>
                <SelectItem value="review">
                  {t('billingPage.prices.import.statusFilter.review')}
                </SelectItem>
                <SelectItem value="skipped">
                  {t('billingPage.prices.import.statusFilter.skipped')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || filteredRows.every((row) => !row.applicable)}
              onClick={() =>
                setSelectedKeys(
                  (current) =>
                    new Set([
                      ...current,
                      ...filteredRows.filter((row) => row.applicable).map((row) => row.key),
                    ]),
                )
              }
            >
              {t('billingPage.prices.import.selectAll')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || selectedKeys.size === 0}
              onClick={() => setSelectedKeys(new Set())}
            >
              {t('billingPage.prices.import.clearSelection')}
            </Button>
          </div>

          <div className="max-h-[460px] overflow-auto rounded-md border">
            <Table className="min-w-[1580px] table-fixed">
              <TableHeader>
                <TableRow variant="static">
                  <TableHead className="w-12" />
                  <TableHead className="w-[100px] overflow-hidden">
                    <OverflowTooltipText value={t('billingPage.prices.columns.provider')} />
                  </TableHead>
                  <TableHead className="w-[160px] overflow-hidden">
                    <OverflowTooltipText value={t('billingPage.prices.columns.model')} />
                  </TableHead>
                  <TableHead className="w-[220px] overflow-hidden">
                    <OverflowTooltipText value={t('billingPage.prices.import.columns.status')} />
                  </TableHead>
                  <TableHead className="w-[100px] overflow-hidden">
                    <OverflowTooltipText value={t('billingPage.prices.import.columns.action')} />
                  </TableHead>
                  <TableHead className="w-[180px] overflow-hidden">
                    <OverflowTooltipText
                      value={t('billingPage.prices.import.columns.sourceModel')}
                    />
                  </TableHead>
                  <TableHead className="w-[100px] overflow-hidden">
                    <OverflowTooltipText value={t('billingPage.prices.import.columns.official')} />
                  </TableHead>
                  <TableHead className="w-[120px] overflow-hidden">
                    <OverflowTooltipText
                      value={t('billingPage.prices.import.columns.multiplier')}
                    />
                  </TableHead>
                  <TableHead className="w-[220px] overflow-hidden">
                    <OverflowTooltipText
                      value={t('billingPage.prices.import.columns.writeFields')}
                    />
                  </TableHead>
                  <TableHead className="w-[220px] overflow-hidden">
                    <OverflowTooltipText value={t('billingPage.prices.import.columns.writeRule')} />
                  </TableHead>
                  <TableHead className="w-[112px] overflow-hidden">
                    <OverflowTooltipText value={t('billingPage.prices.import.columns.existing')} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow variant="static">
                    <TableCell
                      colSpan={11}
                      className="text-muted-foreground py-8 text-center text-sm"
                    >
                      {busy
                        ? t('billingPage.prices.import.loadingPreview')
                        : candidatesError
                          ? t('billingPage.prices.import.candidateFailedEmpty')
                          : t('billingPage.prices.import.emptyPreview')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const reason = formatReason(t, row)
                    const tierLabel =
                      row.serviceTier === '*'
                        ? t('billingPage.prices.tiers.wildcard')
                        : row.serviceTier
                    const bandLabel =
                      row.minInputTokens === 0
                        ? t('billingPage.prices.scope.baseContext')
                        : t('billingPage.prices.scope.fromTokens', {
                            count: row.minInputTokens,
                          })
                    const scopeLabel = `${tierLabel} · ${bandLabel}`
                    const override = matchOverrides.find(
                      (item) =>
                        item.targetProvider === row.provider && item.targetModel === row.model,
                    )
                    return (
                      <TableRow key={row.key} variant="resource">
                        <TableCell className="align-top">
                          <Checkbox
                            checked={selectedKeys.has(row.key)}
                            disabled={!row.applicable || busy || applyBlocked}
                            onCheckedChange={(checked) => toggleRow(row, checked === true)}
                            aria-label={t('billingPage.prices.import.selectRow', {
                              model: row.model,
                              tier: tierLabel,
                              band: bandLabel,
                            })}
                          />
                        </TableCell>
                        <TableCell className="w-[100px] overflow-hidden align-top font-mono text-xs">
                          <OverflowTooltipText value={row.provider} />
                        </TableCell>
                        <TableCell className="w-[160px] overflow-hidden align-top text-xs">
                          <div className="min-w-0 space-y-1">
                            <OverflowTooltipText value={row.model} className="font-mono" />
                            <OverflowTooltipText
                              value={scopeLabel}
                              className="text-muted-foreground"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="w-[220px] overflow-hidden align-top">
                          <div className="min-w-0 space-y-1">
                            <OverflowTooltipText
                              value={t(`billingPage.prices.import.status.${row.status}`, {
                                defaultValue: row.status,
                              })}
                              className={cn(
                                'w-fit max-w-full rounded-full px-2 py-0.5 text-[11px] font-medium',
                                row.status === 'matched' && 'bg-success/10 text-success',
                                row.status === 'ambiguous' && 'bg-warning/10 text-warning',
                                row.status === 'zero_cost' && 'bg-info/10 text-info',
                                ['unmatched', 'unsupported'].includes(row.status) &&
                                  'bg-muted text-muted-foreground',
                                ['conflict', 'invalid'].includes(row.status) &&
                                  'bg-destructive/10 text-destructive',
                              )}
                            />
                            {reason ? (
                              <OverflowTooltipText
                                value={reason}
                                className="text-muted-foreground text-xs leading-4"
                                tooltipClassName="max-w-md whitespace-normal"
                              />
                            ) : null}
                            {row.status === 'ambiguous' && row.reasons[0]?.candidates.length ? (
                              <div className="grid gap-1">
                                <Select
                                  value={
                                    override
                                      ? `${override.sourceProvider}/${override.sourceModel}`
                                      : '__unresolved__'
                                  }
                                  onValueChange={(value) => setMatchOverride(row, value)}
                                  disabled={busy}
                                >
                                  <SelectTrigger className="h-8 min-w-[190px] text-xs">
                                    <SelectValue
                                      placeholder={t(
                                        'billingPage.prices.import.resolveMatchPlaceholder',
                                      )}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__unresolved__" disabled>
                                      {t('billingPage.prices.import.resolveMatchPlaceholder')}
                                    </SelectItem>
                                    {row.reasons[0].candidates.map((candidate) => (
                                      <SelectItem key={candidate} value={candidate}>
                                        {candidate}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {serverEnabled ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!override || busy}
                                    onClick={() =>
                                      void requestServerPreview([...selectedKeys, row.key])
                                    }
                                  >
                                    <RefreshCw className="size-3.5" />
                                    {t('billingPage.prices.import.applyMatchOverride')}
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="w-[100px] overflow-hidden align-top">
                          <OverflowTooltipText
                            value={t(`billingPage.prices.import.actions.${row.action}`)}
                            className={cn(
                              'w-fit max-w-full rounded-md px-2 py-1 text-[11px] font-medium',
                              row.action === 'create' && 'bg-success/10 text-success',
                              row.action === 'update_sync' && 'bg-info/10 text-info',
                              row.action === 'overwrite' && 'bg-warning/10 text-warning',
                              ['skip', 'review'].includes(row.action) &&
                                'bg-muted text-muted-foreground',
                            )}
                          />
                        </TableCell>
                        <TableCell className="w-[180px] overflow-hidden align-top font-mono text-xs">
                          <OverflowTooltipText
                            value={
                              row.matchedProvider && row.matchedModel
                                ? `${row.matchedProvider}/${row.matchedModel}`
                                : '—'
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top text-xs tabular-nums">
                          {row.official
                            ? `${formatPrice(row.official.input, i18n.language)} / ${formatPrice(row.official.output, i18n.language)}`
                            : '—'}
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            className="h-8 w-24 font-mono text-xs"
                            type="number"
                            min="0.01"
                            step="0.1"
                            value={policy.rowMultipliers[row.key] ?? row.multiplier}
                            disabled={busy || !row.official}
                            aria-label={t('billingPage.prices.import.rowMultiplier', {
                              model: row.model,
                              tier: tierLabel,
                              band: bandLabel,
                            })}
                            onChange={(event) => setRowMultiplier(row, Number(event.target.value))}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <PriceFieldList row={row} locale={i18n.language} t={t} />
                        </TableCell>
                        <TableCell className="align-top">
                          <RuleMetadata row={row} t={t} />
                        </TableCell>
                        <TableCell className="w-[112px] overflow-hidden align-top text-xs">
                          {row.existing ? (
                            <div className="min-w-0 space-y-1">
                              <OverflowTooltipText
                                value={t('billingPage.prices.import.existingRule', {
                                  source: t(`billingPage.prices.sources.${row.existing.source}`),
                                })}
                              />
                              <OverflowTooltipText
                                value={`${row.existing.serviceTier} · ${row.existing.minInputTokens}`}
                                className="text-muted-foreground font-mono"
                              />
                            </div>
                          ) : (
                            t('billingPage.prices.import.noExisting')
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {applying && progress ? (
          <section
            role="status"
            aria-live="polite"
            className="border-info/30 bg-info/10 grid gap-2 rounded-md border px-3 py-3"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{t('billingPage.prices.import.progressTitle')}</span>
              <span className="tabular-nums">
                {progress.completed}/{progress.total}
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-[width] duration-200"
                style={{
                  width: `${progress.total === 0 ? 0 : (progress.completed / progress.total) * 100}%`,
                }}
              />
            </div>
            {progress.currentModel ? (
              <p className="text-muted-foreground font-mono text-xs">{progress.currentModel}</p>
            ) : null}
          </section>
        ) : null}

        {applyResult ? (
          <section
            ref={applyResultRef}
            role="status"
            aria-live="polite"
            className={cn(
              'grid gap-3 rounded-md border px-3 py-3',
              applyResult.status === 'applied'
                ? 'border-success/30 bg-success/10'
                : 'border-warning/30 bg-warning/10',
            )}
          >
            <div className="flex items-start gap-2">
              {applyResult.status === 'applied' ? (
                <CircleCheck className="text-success mt-0.5 size-4" />
              ) : (
                <XCircle className="text-warning mt-0.5 size-4" />
              )}
              <div>
                <h3 className="text-sm font-semibold">
                  {t(`billingPage.prices.import.result.${applyResult.status}.title`)}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {t(`billingPage.prices.import.result.${applyResult.status}.description`, {
                    created: applyResult.summary.creates,
                    updated: applyResult.summary.updatesSync,
                    overwritten: applyResult.summary.overwrites,
                    failed: applyResult.summary.failed + applyResult.summary.conflicts,
                  })}
                </p>
              </div>
            </div>
            {applyResult.rows.some(
              (row) => row.status === 'failed' || row.status === 'conflict',
            ) ? (
              <div className="bg-background/70 overflow-auto rounded-md border">
                <Table className="min-w-[680px]">
                  <TableHeader>
                    <TableRow variant="static">
                      <TableHead>{t('billingPage.prices.columns.provider')}</TableHead>
                      <TableHead>{t('billingPage.prices.columns.model')}</TableHead>
                      <TableHead>{t('billingPage.prices.import.result.status')}</TableHead>
                      <TableHead>{t('billingPage.prices.import.result.message')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applyResult.rows
                      .filter((row) => row.status === 'failed' || row.status === 'conflict')
                      .map((row) => (
                        <TableRow key={row.key} variant="static">
                          <TableCell className="font-mono text-xs">{row.provider}</TableCell>
                          <TableCell className="font-mono text-xs">{row.model}</TableCell>
                          <TableCell className="text-xs">
                            {t(`billingPage.prices.import.result.rowStatus.${row.status}`)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.errorMessage || row.errorCode || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {applyResult.rows.some(
                (row) => row.status === 'failed' || row.status === 'conflict',
              ) ? (
                <Button type="button" variant="outline" onClick={retryFailedRows}>
                  <RefreshCw className="size-4" />
                  {t('billingPage.prices.import.result.retryFailed')}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={exportResult}>
                <Download className="size-4" />
                {t('billingPage.prices.import.result.export')}
              </Button>
            </div>
          </section>
        ) : null}

        {error ? <p className="text-destructive text-xs leading-5">{error}</p> : null}
      </DrawerScaffoldBody>

      <DrawerScaffoldFooter>
        {applyResult ? (
          <Button type="button" onClick={onCancel}>
            <Check className="size-4" aria-hidden="true" />
            {t('billingPage.prices.import.complete')}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" disabled={applying} onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={busy || selectedRows.length === 0 || applyBlocked}
              onClick={() => {
                if (selectedSummary.overwrites > 0 || overwriteMode === 'all') {
                  setOverwriteAcknowledged(false)
                  setConfirmOpen(true)
                } else void handleApply()
              }}
            >
              {applying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {t('billingPage.prices.import.confirmApply', { count: selectedRows.length })}
            </Button>
          </>
        )}
      </DrawerScaffoldFooter>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !applying && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('billingPage.prices.import.confirmOverwriteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="grid gap-3">
              <span>
                {t('billingPage.prices.import.confirmOverwriteDescription', {
                  create: selectedSummary.creates,
                  sync: selectedSummary.updatesSync,
                  overwrite: selectedSummary.overwrites,
                  skipped: selectedSummary.notApplied,
                })}
              </span>
              <span className="border-warning/30 bg-warning/10 text-warning rounded-md border px-3 py-2 text-xs leading-5">
                {serverEnabled && preview?.atomic
                  ? t('billingPage.prices.import.confirmServerAtomicRisk')
                  : t('billingPage.prices.import.confirmOverwriteRisk')}
              </span>
              {selectedSummary.overwrites > 0 ? (
                <label className="text-foreground flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={overwriteAcknowledged}
                    disabled={applying}
                    onCheckedChange={(checked) => setOverwriteAcknowledged(checked === true)}
                  />
                  <span>{t('billingPage.prices.import.confirmOverwriteAcknowledgement')}</span>
                </label>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={applying || (selectedSummary.overwrites > 0 && !overwriteAcknowledged)}
              onClick={() => void handleApply()}
            >
              {applying ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('billingPage.prices.import.confirmOverwriteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetPreferencesOpen} onOpenChange={setResetPreferencesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('billingPage.prices.import.resetPreferencesTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('billingPage.prices.import.resetPreferencesDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={resetPreferences}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t('billingPage.prices.import.restoreDefaults')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={discardPendingOpen}
        onOpenChange={(open) => !applying && setDiscardPendingOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('billingPage.prices.import.recovery.discardTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('billingPage.prices.import.recovery.discardDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                writePendingApply(preferenceScope, null)
                setPendingApply(null)
                setPendingApplyError(null)
                setDiscardPendingOpen(false)
              }}
            >
              {t('billingPage.prices.import.recovery.discardAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
