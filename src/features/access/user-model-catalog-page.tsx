import { useMemo, useRef, useState } from 'react'

import { Link } from '@tanstack/react-router'

import {
  ArrowLeft,
  Braces,
  CircleAlert,
  LayoutGrid,
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
import { collectProviders, formatTimestamp, modelDisplayName } from './user-model-format'

const ALL = '__all__'

type CapabilityFilter = 'tools' | 'structuredOutput' | 'reasoning'

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
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState<string>(ALL)
  const [inputModality, setInputModality] = useState<string>(ALL)
  const [capabilities, setCapabilities] = useState<CapabilityFilter[]>([])
  const [accessibleOnly, setAccessibleOnly] = useState(false)
  const [selected, setSelected] = useState<UserCatalogModel | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

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
    const query = search.trim().toLowerCase()

    return models
      .filter((model) => {
        if (accessibleOnly && model.accessible !== true) return false
        if (provider !== ALL && !model.providers.includes(provider)) return false
        if (inputModality !== ALL) {
          if (model.modalities.status !== 'known') return false
          if (!model.modalities.input.includes(inputModality)) return false
        }
        if (!matchesCapabilities(model, capabilities)) return false
        return matchesSearch(model, query)
      })
      .sort((left, right) =>
        modelDisplayName(left).localeCompare(modelDisplayName(right), i18n.language),
      )
  }, [models, search, provider, inputModality, capabilities, accessibleOnly, i18n.language])

  const filtersActive =
    search.trim().length > 0 ||
    provider !== ALL ||
    inputModality !== ALL ||
    capabilities.length > 0 ||
    accessibleOnly

  const clearFilters = () => {
    setSearch('')
    setProvider(ALL)
    setInputModality(ALL)
    setCapabilities([])
    setAccessibleOnly(false)
  }

  return (
    <PublicAccessShell
      subtitleKey="userModels.shellSubtitle"
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
              <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-md">
                <LayoutGrid className="size-5" aria-hidden="true" />
              </span>
              <h1 className="mt-5 text-xl font-semibold">{t('userModels.title')}</h1>
              <p className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-6">
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
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('userModels.signedOut.title')}</p>
              <p className="text-muted-foreground mt-1 max-w-[68ch] text-sm leading-6">
                {t('userModels.signedOut.description')}
              </p>
            </div>
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
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('userModels.filters.searchPlaceholder')}
                    aria-label={t('userModels.filters.searchLabel')}
                    className="pl-9"
                  />
                </div>

                <Select value={provider} onValueChange={setProvider}>
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
                  <Select value={inputModality} onValueChange={setInputModality}>
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

                <ToggleGroup
                  type="multiple"
                  size="sm"
                  variant="outline"
                  value={capabilities}
                  onValueChange={(value: string[]) => setCapabilities(value as CapabilityFilter[])}
                  aria-label={t('userModels.filters.capabilities')}
                >
                  <ToggleGroupItem
                    value="tools"
                    aria-label={t('userModels.capability.tools.label')}
                  >
                    <Wrench aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {t('userModels.capability.tools.label')}
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="structuredOutput"
                    aria-label={t('userModels.capability.structuredOutput.label')}
                  >
                    <Braces aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {t('userModels.capability.structuredOutput.label')}
                    </span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="reasoning"
                    aria-label={t('userModels.capability.reasoning.label')}
                  >
                    <Lightbulb aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {t('userModels.capability.reasoning.label')}
                    </span>
                  </ToggleGroupItem>
                </ToggleGroup>

                {authenticated ? (
                  <ToggleGroup
                    type="multiple"
                    size="sm"
                    variant="outline"
                    value={accessibleOnly ? ['accessible'] : []}
                    onValueChange={(value: string[]) =>
                      setAccessibleOnly(value.includes('accessible'))
                    }
                    aria-label={t('userModels.filters.accessibleOnly')}
                  >
                    <ToggleGroupItem value="accessible">
                      {t('userModels.filters.accessibleOnly')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                ) : null}

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
