import type { ReactNode, RefObject } from 'react'

import { Boxes, Braces, Copy, Lightbulb, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { formGridClassName } from '@/components/shared/form-layout'
import { ProviderLogo, resolveModelVendorId } from '@/components/shared/provider-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type {
  UserModelAvailability,
  UserModelCapabilityStatus,
  UserModelPriceRung,
  UserModelPricing,
} from '@/lib/api/user/models'
import { formatModelPrice } from '@/lib/billing/amount-format'

import type { UserCatalogModel } from './use-user-model-catalog'
import {
  capabilityBadgeVariant,
  formatExactNumber,
  formatMilliseconds,
  formatPercent,
  formatThroughput,
  formatTimestamp,
  modelDisplayName,
} from './user-model-format'

type UserModelDetailSheetProps = {
  model: UserCatalogModel | null
  authenticated: boolean
  onOpenChange: (open: boolean) => void
  /**
   * The card control that opened the sheet.
   *
   * This sheet is driven by state rather than a `SheetTrigger`, so Radix has no
   * trigger to hand focus back to and drops it on the document body. A keyboard
   * user would have to tab from the top of the page again after every close.
   */
  restoreFocusRef?: RefObject<HTMLElement | null>
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-border/70 border-t pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="text-muted-foreground mt-1 text-xs leading-5">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function SpecList({ children }: { children: ReactNode }) {
  return <dl className={formGridClassName}>{children}</dl>
}

function SpecRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="border-border/60 bg-muted/25 min-w-0 rounded-md border px-3 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm [overflow-wrap:anywhere]">
        {children}
        {hint ? <p className="text-muted-foreground mt-1 text-xs leading-5">{hint}</p> : null}
      </dd>
    </div>
  )
}

function UnreportedValue() {
  const { t } = useTranslation()
  return <span className="text-muted-foreground">{t('userModels.value.unreported')}</span>
}

function CapabilityRow({
  status,
  icon: Icon,
  label,
  labels,
  children,
}: {
  status: UserModelCapabilityStatus
  icon: typeof Wrench
  label: string
  labels: Record<UserModelCapabilityStatus, string>
  children?: ReactNode
}) {
  return (
    <div className="border-border/60 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{label}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {children}
        <Badge variant={capabilityBadgeVariant(status)}>{labels[status]}</Badge>
      </span>
    </div>
  )
}

function PriceRungCard({ rung }: { rung: UserModelPriceRung }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  const components: { key: string; label: string; value: number | null }[] = [
    { key: 'input', label: t('userModels.price.input'), value: rung.inputPricePerMillion },
    { key: 'output', label: t('userModels.price.output'), value: rung.outputPricePerMillion },
    {
      key: 'cacheRead',
      label: t('userModels.price.cacheRead'),
      value: rung.cacheReadPricePerMillion,
    },
    {
      key: 'cacheWrite',
      label: t('userModels.price.cacheWrite'),
      value: rung.cacheWritePricePerMillion,
    },
    { key: 'request', label: t('userModels.price.request'), value: rung.requestPrice },
  ]

  return (
    <div className="border-border/60 rounded-md border">
      <p className="border-border/60 text-muted-foreground border-b px-3 py-1.5 text-xs">
        {rung.minInputTokens > 0
          ? t('userModels.price.rungFrom', {
              tokens: formatExactNumber(rung.minInputTokens, locale) ?? rung.minInputTokens,
            })
          : t('userModels.price.rungBase')}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2 sm:grid-cols-3">
        {components.map((component) => (
          <div key={component.key} className="min-w-0">
            <dt className="text-muted-foreground truncate text-xs" title={component.label}>
              {component.label}
            </dt>
            <dd className="mt-0.5 text-sm tabular-nums">
              {component.value === null ? (
                <UnreportedValue />
              ) : (
                formatModelPrice(component.value, locale)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function PricingSection({
  pricing,
  authenticated,
  accessible,
}: {
  pricing: UserModelPricing | null
  authenticated: boolean
  accessible: boolean | null
}) {
  const { t } = useTranslation()

  if (!authenticated) {
    return <p className="text-muted-foreground text-sm">{t('userModels.price.signedOutDetail')}</p>
  }

  if (accessible === false) {
    return <p className="text-muted-foreground text-sm">{t('userModels.price.notCoveredDetail')}</p>
  }

  if (accessible === null) {
    return <p className="text-muted-foreground text-sm">{t('userModels.price.unavailable')}</p>
  }

  if (!pricing || pricing.status !== 'published' || pricing.providers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t('userModels.price.unpublishedDetail')}</p>
    )
  }

  return (
    <div className="grid gap-4">
      {pricing.providers.map((provider) => (
        <div key={provider.provider} className="grid gap-2">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <ProviderLogo providerId={provider.provider} size="sm" />
            <span className="min-w-0 truncate font-mono">{provider.provider}</span>
          </p>

          {provider.tiers.map((tier) => (
            <div key={`${provider.provider}:${tier.serviceTier}`} className="grid gap-2">
              <p className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{t('userModels.price.serviceTier')}</span>
                <code className="font-mono">{tier.serviceTier}</code>
                {tier.isDefault ? (
                  <Badge variant="muted">{t('userModels.price.defaultTier')}</Badge>
                ) : null}
              </p>
              {tier.rungs.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('userModels.price.noRungs')}</p>
              ) : (
                tier.rungs.map((rung) => (
                  <PriceRungCard key={`${tier.serviceTier}:${rung.minInputTokens}`} rung={rung} />
                ))
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function AvailabilitySection({
  availability,
  authenticated,
  accessible,
}: {
  availability: UserModelAvailability | null
  authenticated: boolean
  accessible: boolean | null
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  if (!authenticated) {
    return <p className="text-muted-foreground text-sm">{t('userModels.availability.signedOut')}</p>
  }

  if (accessible === false) {
    return (
      <p className="text-muted-foreground text-sm">{t('userModels.availability.notCovered')}</p>
    )
  }

  if (!availability) {
    return (
      <p className="text-muted-foreground text-sm">{t('userModels.availability.unavailable')}</p>
    )
  }

  const windowHours = availability.window.hours
  const minSamples = availability.window.minSamples

  // An undersampled window is reported as exactly that. Three successes out of
  // three is not full availability, and rendering it as a rate would be a claim
  // the cluster never made.
  if (availability.status === 'insufficient_data') {
    return (
      <div className="border-warning/30 bg-warning/10 rounded-md border px-3 py-2.5">
        <p className="text-sm font-medium">{t('userModels.availability.insufficient.title')}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          {t('userModels.availability.insufficient.description', {
            samples:
              formatExactNumber(availability.sampleCount, locale) ?? availability.sampleCount,
            minSamples: formatExactNumber(minSamples, locale) ?? '—',
            hours: formatExactNumber(windowHours, locale) ?? '—',
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <SpecList>
        <SpecRow label={t('userModels.availability.rate')}>
          <span className="tabular-nums">
            {formatPercent(availability.availabilityRate, locale) ?? <UnreportedValue />}
          </span>
        </SpecRow>
        <SpecRow label={t('userModels.availability.samples')}>
          <span className="tabular-nums">
            {formatExactNumber(availability.sampleCount, locale)}
            {availability.failedCount === null
              ? null
              : ` · ${t('userModels.availability.failed', {
                  value: availability.failedCount,
                })}`}
          </span>
        </SpecRow>
        <SpecRow label={t('userModels.availability.latency')}>
          {availability.avgLatencyMs === null ? (
            <UnreportedValue />
          ) : (
            <span className="tabular-nums">
              {t('userModels.availability.milliseconds', {
                value: formatMilliseconds(availability.avgLatencyMs, locale),
              })}
            </span>
          )}
        </SpecRow>
        <SpecRow label={t('userModels.availability.ttft')}>
          {availability.avgTtftMs === null ? (
            <UnreportedValue />
          ) : (
            <span className="tabular-nums">
              {t('userModels.availability.milliseconds', {
                value: formatMilliseconds(availability.avgTtftMs, locale),
              })}
            </span>
          )}
        </SpecRow>
        <SpecRow label={t('userModels.availability.throughput')}>
          {availability.outputTokensPerSecond === null ? (
            <UnreportedValue />
          ) : (
            <span className="tabular-nums">
              {t('userModels.availability.tokensPerSecond', {
                value: formatThroughput(availability.outputTokensPerSecond, locale),
              })}
            </span>
          )}
        </SpecRow>
        <SpecRow label={t('userModels.availability.lastObserved')}>
          {formatTimestamp(availability.lastObservedAt, locale) ?? <UnreportedValue />}
        </SpecRow>
      </SpecList>

      <p className="text-muted-foreground text-xs leading-5">
        {t('userModels.availability.windowNote', {
          hours: formatExactNumber(windowHours, locale) ?? '—',
          from: formatTimestamp(availability.window.from, locale) ?? '—',
          to: formatTimestamp(availability.window.to, locale) ?? '—',
        })}
      </p>
    </div>
  )
}

export function UserModelDetailSheet({
  model,
  authenticated,
  onOpenChange,
  restoreFocusRef,
}: UserModelDetailSheetProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  // Same reasoning as the catalog card: the header names the model's maker, and
  // no field on the payload reports it, so it comes from the identifier or from
  // nothing at all.
  const vendorId = model ? resolveModelVendorId(model.id, model.displayName) : null

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('userModels.card.copied', { id: value }))
    } catch {
      toast.error(t('userModels.card.copyFailed'))
    }
  }

  return (
    <Sheet open={model !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-xl"
        closeLabel={t('userModels.detail.close')}
        onCloseAutoFocus={(event) => {
          const trigger = restoreFocusRef?.current
          if (!trigger?.isConnected) return
          event.preventDefault()
          trigger.focus()
        }}
      >
        {model ? (
          <>
            <SheetHeader className="border-border/70 border-b">
              <SheetTitle className="flex min-w-0 items-center gap-2">
                {vendorId ? (
                  <ProviderLogo providerId={vendorId} size="md" />
                ) : (
                  <Boxes className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 [overflow-wrap:anywhere]">{modelDisplayName(model)}</span>
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex min-w-0 items-center gap-1">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs" title={model.id}>
                    {model.id}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void handleCopy(model.id)}
                    aria-label={t('userModels.card.copyId')}
                    title={t('userModels.card.copyId')}
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="grid flex-1 gap-5 overflow-y-auto p-4">
              {model.description ? (
                <p className="text-sm leading-6 text-pretty">{model.description}</p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('userModels.card.noDescription')}
                </p>
              )}

              <Section title={t('userModels.detail.specs')}>
                <SpecList>
                  <SpecRow label={t('userModels.spec.context')}>
                    {formatExactNumber(model.contextLength, locale) ?? <UnreportedValue />}
                  </SpecRow>
                  <SpecRow label={t('userModels.spec.maxOutput')}>
                    {formatExactNumber(model.maxOutputTokens, locale) ?? <UnreportedValue />}
                  </SpecRow>
                  <SpecRow
                    label={t('userModels.spec.providers')}
                    hint={t('userModels.spec.providersHint')}
                  >
                    {model.providers.length > 0 ? (
                      <span className="font-mono">{model.providers.join(', ')}</span>
                    ) : (
                      <UnreportedValue />
                    )}
                  </SpecRow>
                  <SpecRow label={t('userModels.spec.ownedBy')}>
                    {model.ownedBy ? (
                      <span className="font-mono">{model.ownedBy}</span>
                    ) : (
                      <UnreportedValue />
                    )}
                  </SpecRow>
                  <SpecRow label={t('userModels.spec.version')}>
                    {model.version ? (
                      <span className="font-mono">{model.version}</span>
                    ) : (
                      <UnreportedValue />
                    )}
                  </SpecRow>
                  <SpecRow label={t('userModels.spec.type')}>
                    {model.type ? (
                      <span className="font-mono">{model.type}</span>
                    ) : (
                      <UnreportedValue />
                    )}
                  </SpecRow>
                </SpecList>
              </Section>

              <Section title={t('userModels.detail.modalities')}>
                {model.modalities.status === 'known' ? (
                  <SpecList>
                    <SpecRow label={t('userModels.modality.input')}>
                      {model.modalities.input.length > 0 ? (
                        <span className="font-mono">{model.modalities.input.join(', ')}</span>
                      ) : (
                        <UnreportedValue />
                      )}
                    </SpecRow>
                    <SpecRow label={t('userModels.modality.output')}>
                      {model.modalities.output.length > 0 ? (
                        <span className="font-mono">{model.modalities.output.join(', ')}</span>
                      ) : (
                        <UnreportedValue />
                      )}
                    </SpecRow>
                  </SpecList>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t('userModels.modality.unreportedDetail')}
                  </p>
                )}
              </Section>

              <Section title={t('userModels.detail.capabilities')}>
                <div className="grid gap-2">
                  <CapabilityRow
                    status={model.capabilities.toolCalling}
                    icon={Wrench}
                    label={t('userModels.capability.tools.label')}
                    labels={{
                      supported: t('userModels.status.supported'),
                      unsupported: t('userModels.status.unsupported'),
                      unknown: t('userModels.status.unknown'),
                    }}
                  />
                  <CapabilityRow
                    status={model.capabilities.structuredOutput}
                    icon={Braces}
                    label={t('userModels.capability.structuredOutput.label')}
                    labels={{
                      supported: t('userModels.status.supported'),
                      unsupported: t('userModels.status.unsupported'),
                      unknown: t('userModels.status.unknown'),
                    }}
                  />
                  <CapabilityRow
                    status={model.capabilities.reasoning.status}
                    icon={Lightbulb}
                    label={t('userModels.capability.reasoning.label')}
                    labels={{
                      supported: t('userModels.status.supported'),
                      unsupported: t('userModels.status.unsupported'),
                      unknown: t('userModels.status.unknown'),
                    }}
                  >
                    {model.capabilities.reasoning.levels.map((level) => (
                      <Badge key={level} variant="outline">
                        <span className="font-mono">{level}</span>
                      </Badge>
                    ))}
                  </CapabilityRow>

                  {model.capabilities.reasoning.budget ? (
                    <SpecList>
                      <SpecRow label={t('userModels.capability.reasoning.budgetRange')}>
                        <span className="tabular-nums">
                          {formatExactNumber(model.capabilities.reasoning.budget.min, locale) ??
                            '—'}
                          {' – '}
                          {formatExactNumber(model.capabilities.reasoning.budget.max, locale) ??
                            '—'}
                        </span>
                      </SpecRow>
                      <SpecRow label={t('userModels.capability.reasoning.budgetFlags')}>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              model.capabilities.reasoning.budget.canDisable ? 'supported' : 'muted'
                            }
                          >
                            {t('userModels.capability.reasoning.canDisable')}
                          </Badge>
                          <Badge
                            variant={
                              model.capabilities.reasoning.budget.dynamic ? 'supported' : 'muted'
                            }
                          >
                            {t('userModels.capability.reasoning.dynamic')}
                          </Badge>
                        </span>
                      </SpecRow>
                    </SpecList>
                  ) : null}

                  {model.capabilities.parameters.length > 0 ? (
                    <div className="border-border/60 rounded-md border px-3 py-2">
                      <p className="text-muted-foreground text-xs">
                        {t('userModels.capability.parameters')}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {model.capabilities.parameters.map((parameter) => (
                          <Badge key={parameter} variant="outline">
                            <span className="font-mono">{parameter}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {model.capabilities.generationMethods.length > 0 ? (
                    <div className="border-border/60 rounded-md border px-3 py-2">
                      <p className="text-muted-foreground text-xs">
                        {t('userModels.capability.generationMethods')}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {model.capabilities.generationMethods.map((method) => (
                          <Badge key={method} variant="outline">
                            <span className="font-mono">{method}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Section>

              <Section
                title={t('userModels.detail.pricing')}
                description={t('userModels.price.ladderNote')}
              >
                <PricingSection
                  pricing={model.pricing}
                  authenticated={authenticated}
                  accessible={model.accessible}
                />
              </Section>

              <Section title={t('userModels.detail.availability')}>
                <AvailabilitySection
                  availability={model.availability}
                  authenticated={authenticated}
                  accessible={model.accessible}
                />
              </Section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
