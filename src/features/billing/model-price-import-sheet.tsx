import { useEffect, useMemo, useState } from 'react'

import { Download, Info, Loader2, RefreshCw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DrawerScaffoldBody,
  DrawerScaffoldFooter,
} from '@/components/shared/drawer-scaffold'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { ModelPrice, ModelPriceInput } from '@/lib/api/management/billing-types'
import {
  type ModelsDevCatalog,
  fetchModelsDevCatalog,
} from '@/lib/billing/models-dev-catalog'
import {
  type ModelPriceImportPolicy,
  type ModelPriceImportRow,
  buildImportNote,
  buildModelPriceImportRows,
  createDefaultImportPolicy,
  isImportRowSelectable,
} from '@/lib/billing/models-dev-match'
import { cn } from '@/lib/utils'

type OverwriteMode = 'missing' | 'sync' | 'all'

type Props = {
  candidates: BillingModelPriceCandidate[]
  candidatesLoading: boolean
  existingPrices: ModelPrice[]
  mutating: boolean
  onCancel: () => void
  onApply: (inputs: Array<{ mode: 'create' | 'update'; resource?: ModelPrice; input: ModelPriceInput }>) => Promise<void>
}

function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
  }).format(value)
}

function canApplyRow(row: ModelPriceImportRow, overwriteMode: OverwriteMode) {
  if (!isImportRowSelectable(row) || !row.final) return false
  if (!row.existing) return true
  if (overwriteMode === 'missing') return false
  if (overwriteMode === 'sync') return row.existing.source === 'sync'
  return true
}

export function ModelPriceImportSheet({
  candidates,
  candidatesLoading,
  existingPrices,
  mutating,
  onCancel,
  onApply,
}: Props) {
  const { t } = useTranslation()
  const [policy, setPolicy] = useState<ModelPriceImportPolicy>(() => createDefaultImportPolicy())
  const [overwriteMode, setOverwriteMode] = useState<OverwriteMode>('missing')
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState<ModelsDevCatalog | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCatalog = async () => {
    setLoadingCatalog(true)
    setCatalogError(null)
    try {
      const next = await fetchModelsDevCatalog()
      setCatalog(next)
    } catch (loadError) {
      setCatalog(null)
      setCatalogError(
        loadError instanceof Error
          ? loadError.message
          : t('billingPage.prices.import.catalogFailed'),
      )
    } finally {
      setLoadingCatalog(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  const rows = useMemo(() => {
    if (!catalog) return [] as ModelPriceImportRow[]
    return buildModelPriceImportRows({
      catalog,
      policy,
      candidates: candidates.map((candidate) => ({
        provider: candidate.provider,
        model: candidate.model,
        label: candidate.label,
      })),
      existingRules: existingPrices.map((price) => ({
        id: price.id,
        provider: price.provider,
        model: price.model,
        source: price.source,
        enabled: price.enabled,
        inputPricePerMillion: price.inputPricePerMillion,
        outputPricePerMillion: price.outputPricePerMillion,
        cacheReadPricePerMillion: price.cacheReadPricePerMillion,
        cacheWritePricePerMillion: price.cacheWritePricePerMillion,
        requestPrice: price.requestPrice,
      })),
    })
  }, [candidates, catalog, existingPrices, policy])

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) =>
      [row.homeProvider, row.homeModel, row.homeLabel, row.matchedProviderId, row.matchedModelId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    )
  }, [rows, search])

  const selectableRows = useMemo(
    () => filteredRows.filter((row) => canApplyRow(row, overwriteMode)),
    [filteredRows, overwriteMode],
  )

  const selectedRows = useMemo(
    () => selectableRows.filter((row) => selectedKeys.has(row.key)),
    [selectableRows, selectedKeys],
  )

  useEffect(() => {
    // Drop selections that are no longer applicable after policy/mode changes.
    setSelectedKeys((current) => {
      const allowed = new Set(selectableRows.map((row) => row.key))
      const next = new Set([...current].filter((key) => allowed.has(key)))
      return next.size === current.size ? current : next
    })
  }, [selectableRows])

  const setRuleMultiplier = (id: string, multiplier: number) => {
    setPolicy((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === id ? { ...rule, multiplier } : rule)),
    }))
  }

  const toggleRow = (row: ModelPriceImportRow, checked: boolean) => {
    if (!canApplyRow(row, overwriteMode)) return
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (checked) next.add(row.key)
      else next.delete(row.key)
      return next
    })
  }

  const selectAllSelectable = () => {
    setSelectedKeys(new Set(selectableRows.map((row) => row.key)))
  }

  const clearSelection = () => setSelectedKeys(new Set())

  const handleApply = async () => {
    if (selectedRows.length === 0) {
      setError(t('billingPage.prices.import.validation.selectRows'))
      return
    }

    setApplying(true)
    setError(null)
    try {
      const fetchedAt = catalog?.fetchedAt ?? new Date().toISOString()
      const inputs = selectedRows.map((row) => {
        const final = row.final!
        const input: ModelPriceInput = {
          provider: row.homeProvider,
          model: row.homeModel,
          inputPricePerMillion: final.input,
          outputPricePerMillion: final.output,
          cacheReadPricePerMillion: final.cacheRead,
          cacheWritePricePerMillion: final.cacheWrite,
          requestPrice: final.request,
          enabled: true,
          source: 'sync',
          note: buildImportNote(row, fetchedAt),
        }
        if (row.existing) {
          return {
            mode: 'update' as const,
            resource: existingPrices.find((price) => price.id === row.existing?.id),
            input,
          }
        }
        return { mode: 'create' as const, input }
      })

      // Defensive: skip updates without resolved resource ids.
      const actionable = inputs.filter(
        (item) => item.mode === 'create' || (item.mode === 'update' && item.resource),
      )
      await onApply(actionable)
      toast.success(
        t('billingPage.prices.import.applied', {
          count: actionable.length,
        }),
      )
      onCancel()
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : t('billingPage.toast.actionFailed'),
      )
    } finally {
      setApplying(false)
    }
  }

  const busy = mutating || applying || loadingCatalog || candidatesLoading

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DrawerScaffoldBody className="grid gap-4 p-4 sm:p-5">
        <div className="border-info/30 bg-info/10 text-info rounded-md border px-3 py-2 text-xs leading-5">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 text-pretty">{t('billingPage.prices.import.manualConfirmHint')}</span>
          </div>
        </div>

        <section className="grid gap-3 rounded-md border px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{t('billingPage.prices.import.catalogTitle')}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {catalog
                  ? t('billingPage.prices.import.catalogReady', {
                      count: catalog.models.length,
                      time: new Date(catalog.fetchedAt).toLocaleString(),
                    })
                  : t('billingPage.prices.import.catalogPending')}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void loadCatalog()}>
              {loadingCatalog ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {t('billingPage.prices.import.reloadCatalog')}
            </Button>
          </div>
          {catalogError ? (
            <p className="text-destructive text-xs leading-5">{catalogError}</p>
          ) : null}
        </section>

        <section className="grid gap-3 rounded-md border px-3 py-3">
          <div>
            <h3 className="text-sm font-semibold">{t('billingPage.prices.import.policyTitle')}</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('billingPage.prices.import.policyHint')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">{t('billingPage.prices.import.defaultMultiplier')}</span>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={String(policy.defaultMultiplier)}
                disabled={busy}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setPolicy((current) => ({
                    ...current,
                    defaultMultiplier: Number.isFinite(value) && value >= 0 ? value : 0,
                  }))
                }}
              />
            </label>
            <label className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">{t('billingPage.prices.import.overwriteMode')}</span>
              <Select
                value={overwriteMode}
                onValueChange={(value) => setOverwriteMode(value as OverwriteMode)}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">{t('billingPage.prices.import.overwriteMissing')}</SelectItem>
                  <SelectItem value="sync">{t('billingPage.prices.import.overwriteSync')}</SelectItem>
                  <SelectItem value="all">{t('billingPage.prices.import.overwriteAll')}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {policy.rules.map((rule) => (
              <label key={rule.id} className="grid gap-1.5 text-xs">
                <span className="text-muted-foreground">
                  {t('billingPage.prices.import.familyMultiplier', { family: rule.label })}
                </span>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={String(rule.multiplier)}
                  disabled={busy}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    setRuleMultiplier(rule.id, Number.isFinite(value) && value >= 0 ? value : 0)
                  }}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={policy.includeCachePrices}
                disabled={busy}
                onCheckedChange={(checked) =>
                  setPolicy((current) => ({ ...current, includeCachePrices: checked === true }))
                }
              />
              <span>{t('billingPage.prices.import.includeCache')}</span>
            </label>
            <label className="flex items-center gap-2">
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
        </section>

        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{t('billingPage.prices.import.previewTitle')}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {t('billingPage.prices.import.previewHint', {
                  selected: selectedRows.length,
                  selectable: selectableRows.length,
                  total: rows.length,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy || selectableRows.length === 0} onClick={selectAllSelectable}>
                {t('billingPage.prices.import.selectAll')}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy || selectedKeys.size === 0} onClick={clearSelection}>
                {t('billingPage.prices.import.clearSelection')}
              </Button>
            </div>
          </div>

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

          <div className="max-h-[420px] overflow-auto rounded-md border">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow variant="static">
                  <TableHead className="w-10" />
                  <TableHead>{t('billingPage.prices.columns.provider')}</TableHead>
                  <TableHead>{t('billingPage.prices.columns.model')}</TableHead>
                  <TableHead>{t('billingPage.prices.import.columns.status')}</TableHead>
                  <TableHead>{t('billingPage.prices.import.columns.sourceModel')}</TableHead>
                  <TableHead>{t('billingPage.prices.import.columns.official')}</TableHead>
                  <TableHead>{t('billingPage.prices.import.columns.multiplier')}</TableHead>
                  <TableHead>{t('billingPage.prices.import.columns.final')}</TableHead>
                  <TableHead>{t('billingPage.prices.import.columns.existing')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow variant="static">
                    <TableCell colSpan={9} className="text-muted-foreground py-8 text-center text-sm">
                      {loadingCatalog || candidatesLoading
                        ? t('billingPage.prices.import.loadingPreview')
                        : t('billingPage.prices.import.emptyPreview')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const selectable = canApplyRow(row, overwriteMode)
                    const checked = selectedKeys.has(row.key)
                    return (
                      <TableRow key={row.key} variant="resource">
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            disabled={!selectable || busy}
                            onCheckedChange={(value) => toggleRow(row, value === true)}
                            aria-label={t('billingPage.prices.import.selectRow', {
                              model: row.homeModel,
                            })}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.homeProvider}</TableCell>
                        <TableCell className="max-w-[180px]">
                          <div className="truncate font-mono text-xs" title={row.homeModel}>
                            {row.homeModel}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-medium',
                              row.status === 'matched' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                              row.status === 'ambiguous' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                              row.status === 'unmatched' && 'bg-muted text-muted-foreground',
                              row.status === 'zero_cost' && 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
                            )}
                          >
                            {t(`billingPage.prices.import.status.${row.status}`)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[180px] font-mono text-xs">
                          {row.matchedProviderId && row.matchedModelId
                            ? `${row.matchedProviderId}/${row.matchedModelId}`
                            : '—'}
                        </TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {row.official
                            ? `${formatPrice(row.official.input)} / ${formatPrice(row.official.output)}`
                            : '—'}
                        </TableCell>
                        <TableCell className="tabular-nums text-xs">×{formatPrice(row.multiplier)}</TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {row.final
                            ? `${formatPrice(row.final.input)} / ${formatPrice(row.final.output)}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.existing
                            ? t('billingPage.prices.import.existingRule', {
                                source: t(`billingPage.prices.sources.${row.existing.source}`),
                              })
                            : t('billingPage.prices.import.noExisting')}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {error ? <p className="text-destructive text-xs leading-5">{error}</p> : null}
      </DrawerScaffoldBody>

      <DrawerScaffoldFooter>
        <Button type="button" variant="outline" disabled={applying} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="button" disabled={busy || selectedRows.length === 0} onClick={() => void handleApply()}>
          {applying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          {t('billingPage.prices.import.confirmApply', { count: selectedRows.length })}
        </Button>
      </DrawerScaffoldFooter>
    </div>
  )
}
