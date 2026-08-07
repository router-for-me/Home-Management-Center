import { useState } from 'react'

import { Boxes, Braces, Check, ChevronRight, Copy, Lightbulb, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ProviderLogo, resolveModelVendorId } from '@/components/shared/provider-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { UserModelCapabilityStatus } from '@/lib/api/user/models'
import { formatModelPrice } from '@/lib/billing/amount-format'

import type { UserCatalogModel } from './use-user-model-catalog'
import {
  capabilityBadgeVariant,
  formatCompactTokens,
  modelDisplayName,
  pricingEntryPoint,
} from './user-model-format'

type UserModelCardProps = {
  model: UserCatalogModel
  authenticated: boolean
  onOpenDetails: (model: UserCatalogModel) => void
}

function CapabilityBadge({
  status,
  icon: Icon,
  labels,
}: {
  status: UserModelCapabilityStatus
  icon: typeof Wrench
  labels: Record<UserModelCapabilityStatus, string>
}) {
  return (
    <Badge variant={capabilityBadgeVariant(status)}>
      <Icon aria-hidden="true" />
      {labels[status]}
    </Badge>
  )
}

export function UserModelCard({ model, authenticated, onOpenDetails }: UserModelCardProps) {
  const { t, i18n } = useTranslation()
  const [copied, setCopied] = useState(false)

  const locale = i18n.language
  // The brand mark answers "whose model is this", which no field on the payload
  // reports: `providers[]` names the upstream that serves it, so a GLM model
  // reached through the `codex` provider would otherwise wear an OpenAI mark.
  const vendorId = resolveModelVendorId(model.id, model.displayName)
  const entryPoint = pricingEntryPoint(model.pricing)
  const contextLength = formatCompactTokens(model.contextLength, locale)
  const maxOutputTokens = formatCompactTokens(model.maxOutputTokens, locale)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(model.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      toast.success(t('userModels.card.copied', { id: model.id }))
    } catch {
      toast.error(t('userModels.card.copyFailed'))
    }
  }

  return (
    // The row rhythm is one `gap-3` on the column rather than a `mt-3` on each
    // child, so the footer's auto margin can only ever *add* to that gap. When
    // the spacing lived on the children the divider had nothing of its own and
    // sat flush against the badges on whichever card happened to be tallest.
    <article className="bg-card hover:border-primary/40 focus-within:border-primary/40 flex h-full min-w-0 flex-col gap-3 rounded-lg border p-4 transition-colors">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0">
          {vendorId ? (
            <ProviderLogo providerId={vendorId} size="lg" />
          ) : (
            <span className="border-border bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-md border">
              <Boxes className="size-4" aria-hidden="true" />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 text-sm leading-6 font-semibold">
            <button
              type="button"
              onClick={() => onOpenDetails(model)}
              aria-haspopup="dialog"
              className="focus-visible:ring-ring/50 hover:text-primary group flex w-full min-w-0 items-center gap-1 rounded-sm text-left outline-none focus-visible:ring-3"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{modelDisplayName(model)}</span>
              <ChevronRight
                className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </h3>
          {model.providers.length > 0 ? (
            // Labelled rather than bare: under the model name and beside a
            // vendor mark, a loose `codex · glm` reads as a list of makers. The
            // label is the word usage, billing and the admin providers page
            // already use for these same identifiers; the detail sheet carries
            // the line that separates a serving provider from a model maker.
            <p
              className="text-muted-foreground mt-0.5 truncate text-xs"
              title={model.providers.join(', ')}
            >
              {t('userModels.spec.providers')}{' '}
              <span className="font-mono">{model.providers.join(' · ')}</span>
            </p>
          ) : null}
        </div>

        {model.accessible === true ? (
          <Badge variant="success">{t('userModels.card.access.included')}</Badge>
        ) : null}
        {model.accessible === false ? (
          <Badge variant="muted">{t('userModels.card.access.excluded')}</Badge>
        ) : null}
      </div>

      <div className="bg-muted/40 border-border/70 flex min-w-0 items-center gap-1 rounded-md border px-2 py-1">
        <code className="min-w-0 flex-1 truncate font-mono text-xs" title={model.id}>
          {model.id}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => void handleCopy()}
          aria-label={t('userModels.card.copyId')}
          title={t('userModels.card.copyId')}
        >
          {copied ? (
            <Check className="text-success" aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
        </Button>
      </div>

      <p className="text-muted-foreground line-clamp-2 text-sm leading-6 text-pretty">
        {model.description ?? t('userModels.card.noDescription')}
      </p>

      <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <dt className="shrink-0">{t('userModels.spec.context')}</dt>
          <dd className="text-foreground min-w-0 truncate font-medium tabular-nums">
            {contextLength ?? t('userModels.value.unreported')}
          </dd>
        </div>
        <div className="flex min-w-0 items-baseline gap-1.5">
          <dt className="shrink-0">{t('userModels.spec.maxOutput')}</dt>
          <dd className="text-foreground min-w-0 truncate font-medium tabular-nums">
            {maxOutputTokens ?? t('userModels.value.unreported')}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        {model.modalities.status === 'known' ? (
          <>
            {model.modalities.input.length > 0 ? (
              <Badge variant="outline">
                <span className="text-muted-foreground">{t('userModels.modality.input')}</span>
                <span className="font-mono">{model.modalities.input.join(' ')}</span>
              </Badge>
            ) : null}
            {model.modalities.output.length > 0 ? (
              <Badge variant="outline">
                <span className="text-muted-foreground">{t('userModels.modality.output')}</span>
                <span className="font-mono">{model.modalities.output.join(' ')}</span>
              </Badge>
            ) : null}
          </>
        ) : (
          <Badge variant="unknown">{t('userModels.modality.unreported')}</Badge>
        )}

        <CapabilityBadge
          status={model.capabilities.toolCalling}
          icon={Wrench}
          labels={{
            supported: t('userModels.capability.tools.supported'),
            unsupported: t('userModels.capability.tools.unsupported'),
            unknown: t('userModels.capability.tools.unknown'),
          }}
        />
        <CapabilityBadge
          status={model.capabilities.structuredOutput}
          icon={Braces}
          labels={{
            supported: t('userModels.capability.structuredOutput.supported'),
            unsupported: t('userModels.capability.structuredOutput.unsupported'),
            unknown: t('userModels.capability.structuredOutput.unknown'),
          }}
        />
        <CapabilityBadge
          status={model.capabilities.reasoning.status}
          icon={Lightbulb}
          labels={{
            supported: t('userModels.capability.reasoning.supported'),
            unsupported: t('userModels.capability.reasoning.unsupported'),
            unknown: t('userModels.capability.reasoning.unknown'),
          }}
        />
      </div>

      <div className="border-border/70 mt-auto border-t pt-3">
        <CardPriceSummary
          authenticated={authenticated}
          accessible={model.accessible}
          published={model.pricing?.status === 'published'}
          entryPoint={entryPoint}
          locale={locale}
        />
      </div>
    </article>
  )
}

function CardPriceSummary({
  authenticated,
  accessible,
  published,
  entryPoint,
  locale,
}: {
  authenticated: boolean
  accessible: boolean | null
  published: boolean
  entryPoint: ReturnType<typeof pricingEntryPoint>
  locale: string
}) {
  const { t } = useTranslation()

  if (!authenticated) {
    return <p className="text-muted-foreground text-xs">{t('userModels.price.signedOut')}</p>
  }

  if (accessible === false) {
    return <p className="text-muted-foreground text-xs">{t('userModels.price.notCovered')}</p>
  }

  if (accessible === null) {
    return <p className="text-muted-foreground text-xs">{t('userModels.price.unavailable')}</p>
  }

  // A published ladder with no readable entry rung, or no ladder at all, is the
  // same message: this cluster has not put a price on the model. It is never a
  // zero price.
  if (!published || !entryPoint) {
    return <p className="text-muted-foreground text-xs">{t('userModels.price.unpublished')}</p>
  }

  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p className="min-w-0 text-xs">
        <span className="text-muted-foreground">{t('userModels.price.from')}</span>{' '}
        <span className="text-foreground font-semibold tabular-nums">
          {entryPoint.input === null
            ? t('userModels.value.unreported')
            : formatModelPrice(entryPoint.input, locale)}
        </span>{' '}
        <span className="text-muted-foreground">{t('userModels.price.inSuffix')}</span>{' '}
        <span className="text-muted-foreground">/</span>{' '}
        <span className="text-foreground font-semibold tabular-nums">
          {entryPoint.output === null
            ? t('userModels.value.unreported')
            : formatModelPrice(entryPoint.output, locale)}
        </span>{' '}
        <span className="text-muted-foreground">{t('userModels.price.outSuffix')}</span>
      </p>
      {entryPoint.tiered ? (
        <Badge variant="info">
          {t('userModels.price.tiered', { rungs: entryPoint.maxRungCount })}
        </Badge>
      ) : null}
    </div>
  )
}
