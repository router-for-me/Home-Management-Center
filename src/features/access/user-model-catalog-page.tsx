import { useEffect, useMemo, useRef, useState } from 'react'

import { Link, useNavigate, useSearch } from '@tanstack/react-router'

import {
  ArrowLeft,
  Braces,
  CircleAlert,
  KeyRound,
  Lightbulb,
  RefreshCcw,
  Search,
  UserRound,
  Wrench,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { embeddedEntryLinks } from '@/lib/embedded-entry-links'

import { type UserCatalogModel, useUserModelCatalog } from './use-user-model-catalog'
import { UserModelCard } from './user-model-card'
import { UserModelDetailSheet } from './user-model-detail-sheet'
import {
  type UserModelSort,
  collectProviders,
  compareUserModels,
  formatTimestamp,
} from './user-model-format'
import {
  type UserModelCapabilityFilter as CapabilityFilter,
  type UserModelRouteSearch,
  capabilityFiltersToParam,
  normalizeCapabilityFilters,
  normalizeUserModelRouteSearch,
} from './user-model-route'

const ALL = '__all__'

const CATALOG_PATH = '/user/models'

// The one chip in the quick-filter group that narrows by key coverage rather
// than by capability. It shares the group so the toolbar reads as one row of
// filters instead of two segmented controls with a seam between them.
const ACCESSIBLE_CHIP = 'accessible'

function collectInputModalities(models: UserCatalogModel[]) {
  const modalities = new Set<string>()
  for (const model of models) {
    if (model.modalities.status !== 'known') continue
    for (const modality of model.modalities.input) modalities.add(modality)
  }
  return [...modalities].sort((left, right) => left.localeCompare(right))
}

function matchesSearch(model: UserCatalogModel, query: string) {
  if (!query) return true

  const haystack = [model.id, model.displayName, model.description, ...model.providers]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function matchesCapabilities(model: UserCatalogModel, capabilities: CapabilityFilter[]) {
  // Every capability filter is a positive match: only a model the cluster said
  // can do this passes. A model that was never described does not sneak in, and
  // the toolbar says so out loud rather than leaving the buyer to guess.
  return capabilities.every((capability) => {
    if (capability === 'tools') return model.capabilities.toolCalling === 'supported'
    if (capability === 'structuredOutput')
      return model.capabilities.structuredOutput === 'supported'
    return model.capabilities.reasoning.status === 'supported'
  })
}

export function UserModelCatalogPage() {
  const { t, i18n } = useTranslation()
  const catalog = useUserModelCatalog()
  // Anchored to the path rather than to a `Route` object: this page is mounted
  // by both the generated route tree and the standalone user entry's tree, and
  // both register it at exactly this path.
  const navigate = useNavigate({ from: CATALOG_PATH })
  const routeSearch = useSearch({ from: CATALOG_PATH })
  const [selected, setSelected] = useState<UserCatalogModel | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const query = routeSearch.q ?? ''
  const provider = routeSearch.provider ?? ALL
  const inputModality = routeSearch.modality ?? ALL
  const capabilities = useMemo(
    () => normalizeCapabilityFilters(routeSearch.caps),
    [routeSearch.caps],
  )
  const accessibleOnly = routeSearch.mine === true
  const sort: UserModelSort = routeSearch.sort ?? 'name'

  // The text box keeps its own copy so typing stays responsive and a trailing
  // space survives; the URL holds the trimmed value it actually filters on.
  const [searchText, setSearchText] = useState(query)
  useEffect(() => {
    setSearchText((current) => (current.trim() === query ? current : query))
  }, [query])

  const patchSearch = (patch: Partial<UserModelRouteSearch>) => {
    void navigate({
      search: (previous: Record<string, unknown>) =>
        normalizeUserModelRouteSearch({ ...previous, ...patch }),
      replace: true,
    })
  }

  const openDetails = (model: UserCatalogModel) => {
    // Remember the control the buyer opened the sheet from so closing it puts
    // the keyboard back on that card instead of at the top of the document.
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelected(model)
  }

  const { models, authenticated } = catalog
  const providers = useMemo(() => collectProviders(models), [models])
  const inputModalities = useMemo(() => collectInputModalities(models), [models])

  const filtered = useMemo(() => {
    const needle = query.toLowerCase()

    return models
      .filter((model) => {
        if (accessibleOnly && model.accessible !== true) return false
        if (provider !== ALL && !model.providers.includes(provider)) return false
        if (inputModality !== ALL) {
          if (model.modalities.status !== 'known') return false
          if (!model.modalities.input.includes(inputModality)) return false
        }
        if (!matchesCapabilities(model, capabilities)) return false
        return matchesSearch(model, needle)
      })
      .sort(compareUserModels(sort, i18n.language))
  }, [models, query, provider, inputModality, capabilities, accessibleOnly, sort, i18n.language])

  const quickFilters = useMemo(
    () => (accessibleOnly ? [...capabilities, ACCESSIBLE_CHIP] : [...capabilities]),
    [capabilities, accessibleOnly],
  )

  const handleQuickFilters = (values: string[]) => {
    patchSearch({
      caps: capabilityFiltersToParam(values),
      mine: values.includes(ACCESSIBLE_CHIP) ? true : undefined,
    })
  }

  const filtersActive =
    query.length > 0 ||
    provider !== ALL ||
    inputModality !== ALL ||
    capabilities.length > 0 ||
    accessibleOnly

  const clearFilters = () => {
    setSearchText('')
    // Sorting is not a filter: a buyer who clears the filters is still shopping
    // by price, so the chosen order survives.
    void navigate({
      search: () => (routeSearch.sort ? { sort: routeSearch.sort } : {}),
      replace: true,
    })
  }

  return (
    <PublicAccessShell
      // The shell subtitle names the product; the page's own h1 names the page.
      // Pointing both at "Model catalog" printed the same words twice, one above
      // the other, and told the buyer nothing on the second reading.
      subtitleKey="embeddedPortal.shellSubtitle"
      headerActions={
        <Button asChild variant="outline" size="sm">
          <a href={authenticated ? embeddedEntryLinks.userWorkspace : embeddedEntryLinks.userLogin}>
            <UserRound className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {authenticated ? t('userModels.header.workspace') : t('userModels.header.signIn')}
            </span>
          </a>
        </Button>
      }
    >
      <section className="grid gap-6">
        <Button asChild variant="text" size="sm" className="w-fit px-0">
          <a href={embeddedEntryLinks.bridge}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('userModels.back')}
          </a>
        </Button>

        <div className="bg-card rounded-lg border p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">{t('userModels.title')}</h1>
              <p className="text-muted-foreground mt-1.5 max-w-[68ch] text-sm leading-6">
                {t('userModels.description')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
              <Button
                variant="outline"
                onClick={catalog.refresh}
                disabled={catalog.loading || catalog.fetching}
              >
                <RefreshCcw
                  className={catalog.fetching ? 'size-4 animate-spin' : 'size-4'}
                  aria-hidden="true"
                />
                {t('userModels.actions.refresh')}
              </Button>
              {catalog.fetchedAt ? (
                <p className="text-muted-foreground text-xs">
                  {t('userModels.fetchedAt', {
                    time: formatTimestamp(catalog.fetchedAt, i18n.language) ?? '—',
                  })}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {!authenticated && !catalog.unsupported ? (
          <div className="border-info/25 bg-info/10 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-sm font-medium">{t('userModels.signedOut.title')}</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/user/login">{t('userModels.signedOut.signIn')}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/user/register">{t('userModels.signedOut.register')}</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {catalog.accessibleError ? (
          <div className="border-warning/30 bg-warning/10 flex min-w-0 gap-3 rounded-lg border p-4">
            <CircleAlert className="text-warning size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('userModels.accessibleError.title')}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-6 [overflow-wrap:anywhere]">
                {t('userModels.accessibleError.description', {
                  message: catalog.accessibleError,
                })}
              </p>
            </div>
          </div>
        ) : null}

        {catalog.access && catalog.access.reason !== 'unrestricted' ? (
          <div className="border-border bg-muted/40 rounded-lg border p-4">
            <p className="text-sm font-medium">
              {catalog.access.reason === 'no_api_keys'
                ? t('userModels.access.noApiKeys.title')
                : t('userModels.access.modelGroups.title')}
            </p>
            <p className="text-muted-foreground mt-1 max-w-[68ch] text-sm leading-6">
              {catalog.access.reason === 'no_api_keys'
                ? t('userModels.access.noApiKeys.description')
                : t('userModels.access.modelGroups.description', {
                    keys: catalog.access.apiKeyCount,
                  })}
            </p>
          </div>
        ) : null}

        {catalog.unsupported ? (
          <EmptyState
            kind="unsupported"
            title={t('userModels.unsupported.title')}
            description={t('userModels.unsupported.description')}
            className="bg-card rounded-lg border"
          />
        ) : catalog.error ? (
          <EmptyState
            kind="error"
            title={t('userModels.error.title')}
            description={catalog.error}
            className="bg-card rounded-lg border"
            action={
              <Button variant="outline" onClick={catalog.refresh}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                {t('userModels.actions.retry')}
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 basis-64">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    value={searchText}
                    onChange={(event) => {
                      setSearchText(event.target.value)
                      patchSearch({ q: event.target.value })
                    }}
                    placeholder={t('userModels.filters.searchPlaceholder')}
                    aria-label={t('userModels.filters.searchLabel')}
                    className="pl-9"
                  />
                </div>

                <Select
                  value={provider}
                  onValueChange={(value) =>
                    patchSearch({ provider: value === ALL ? undefined : value })
                  }
                >
                  <SelectTrigger
                    className="w-auto min-w-40"
                    aria-label={t('userModels.filters.provider')}
                  >
                    <SelectValue placeholder={t('userModels.filters.provider')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('userModels.filters.allProviders')}</SelectItem>
                    {providers.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {inputModalities.length > 0 ? (
                  <Select
                    value={inputModality}
                    onValueChange={(value) =>
                      patchSearch({ modality: value === ALL ? undefined : value })
                    }
                  >
                    <SelectTrigger
                      className="w-auto min-w-40"
                      aria-label={t('userModels.filters.inputModality')}
                    >
                      <SelectValue placeholder={t('userModels.filters.inputModality')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t('userModels.filters.allModalities')}</SelectItem>
                      {inputModalities.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                {authenticated ? (
                  <Select
                    value={sort}
                    onValueChange={(value) =>
                      patchSearch({
                        sort: value === 'name' ? undefined : (value as 'price-asc' | 'price-desc'),
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-auto min-w-40"
                      aria-label={t('userModels.filters.sort')}
                    >
                      <SelectValue placeholder={t('userModels.filters.sort')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">{t('userModels.filters.sortName')}</SelectItem>
                      <SelectItem value="price-asc">
                        {t('userModels.filters.sortPriceAsc')}
                      </SelectItem>
                      <SelectItem value="price-desc">
                        {t('userModels.filters.sortPriceDesc')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}

                {/* One group, no container chrome, item height matched to the
                    inputs beside it: these are filter chips in the same row as
                    the other filters, not a segmented control of their own. */}
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={quickFilters}
                  onValueChange={handleQuickFilters}
                  aria-label={t('userModels.filters.quickFilters')}
                  className="flex-wrap gap-1.5 border-0 bg-transparent p-0 shadow-none"
                >
                  <ToggleGroupItem
                    value="tools"
                    className="border-input"
                    aria-label={t('userModels.capability.tools.label')}
                  >
                    <Wrench aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {t('userModels.capability.tools.label')}
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="structuredOutput"
                    className="border-input"
                    aria-label={t('userModels.capability.structuredOutput.label')}
                  >
                    <Braces aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {t('userModels.capability.structuredOutput.label')}
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="reasoning"
                    className="border-input"
                    aria-label={t('userModels.capability.reasoning.label')}
                  >
                    <Lightbulb aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {t('userModels.capability.reasoning.label')}
                    </span>
                  </ToggleGroupItem>
                  {authenticated ? (
                    <ToggleGroupItem
                      value={ACCESSIBLE_CHIP}
                      className="border-input"
                      aria-label={t('userModels.filters.accessibleOnly')}
                    >
                      <KeyRound aria-hidden="true" />
                      <span className="hidden sm:inline">
                        {t('userModels.filters.accessibleOnly')}
                      </span>
                    </ToggleGroupItem>
                  ) : null}
                </ToggleGroup>

                {filtersActive ? (
                  <Button variant="text" size="sm" onClick={clearFilters}>
                    {t('userModels.filters.clear')}
                  </Button>
                ) : null}
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <span aria-live="polite">
                  {t('userModels.count', { shown: filtered.length, total: models.length })}
                </span>
                {capabilities.length > 0 || inputModality !== ALL ? (
                  <Badge variant="unknown">{t('userModels.filters.unreportedHidden')}</Badge>
                ) : null}
              </div>
            </div>

            {catalog.loading ? (
              <CatalogSkeleton />
            ) : models.length === 0 ? (
              <EmptyState
                kind="empty"
                title={t('userModels.empty.title')}
                description={t('userModels.empty.description')}
                className="bg-card rounded-lg border"
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                kind="filtered-empty"
                title={t('userModels.filteredEmpty.title')}
                description={t('userModels.filteredEmpty.description')}
                className="bg-card rounded-lg border"
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    {t('userModels.filters.clear')}
                  </Button>
                }
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((model) => (
                  <li key={model.id} className="min-w-0">
                    <UserModelCard
                      model={model}
                      authenticated={authenticated}
                      onOpenDetails={openDetails}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <UserModelDetailSheet
        model={selected}
        authenticated={authenticated}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        restoreFocusRef={triggerRef}
      />
    </PublicAccessShell>
  )
}

function CatalogSkeleton() {
  const { t } = useTranslation()

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-live="polite"
      aria-label={t('userModels.loading')}
    >
      {Array.from({ length: 6 }, (_, index) => index).map((index) => (
        <div key={index} className="bg-card grid gap-3 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-7 w-full rounded-md" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/5" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
