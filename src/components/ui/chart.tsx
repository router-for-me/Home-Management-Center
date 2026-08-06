import * as React from 'react'

import * as RechartsPrimitive from 'recharts'
import type { TooltipValueType } from 'recharts'

import { cn } from '@/lib/utils'

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: '', dark: '.dark' } as const

const INITIAL_DIMENSION = { width: 320, height: 200 } as const
type TooltipNameType = number | string

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
  initialDimension?: {
    width: number
    height: number
  }
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, config]) => config.theme ?? config.color)

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function toConfigKey(value: unknown, fallback = 'value'): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback
}

function getPayloadFill(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || !('fill' in payload)) {
    return undefined
  }

  const fill = (payload as { fill?: unknown }).fill
  return typeof fill === 'string' ? fill : undefined
}

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = 'dot',
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<'div'> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: 'line' | 'dot' | 'dashed'
    nameKey?: string
    labelKey?: string
  } & Omit<
    RechartsPrimitive.DefaultTooltipContentProps<TooltipValueType, TooltipNameType>,
    'accessibilityLayer'
  >) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = labelKey ?? toConfigKey(item?.dataKey ?? item?.name)
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === 'string' ? (config[label]?.label ?? label) : itemConfig?.label

    if (labelFormatter) {
      return (
        <div className={cn('font-medium', labelClassName)}>{labelFormatter(value, payload)}</div>
      )
    }

    if (!value) {
      return null
    }

    return <div className={cn('font-medium', labelClassName)}>{value}</div>
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== 'dot'

  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== 'none')
          .map((item, index) => {
            const key = nameKey ?? toConfigKey(item.name ?? item.dataKey)
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color ?? getPayloadFill(item.payload) ?? item.color

            return (
              <div
                key={index}
                className={cn(
                  '[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5',
                  indicator === 'dot' && 'items-center',
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(
                    item.value,
                    item.name,
                    item,
                    index,
                    item.payload as Parameters<typeof formatter>[4],
                  )
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            'shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)',
                            {
                              'h-2.5 w-2.5': indicator === 'dot',
                              'w-1': indicator === 'line',
                              'w-0 border-[1.5px] border-dashed bg-transparent':
                                indicator === 'dashed',
                              'my-0.5': nestLabel && indicator === 'dashed',
                            },
                          )}
                          style={
                            {
                              '--color-bg': indicatorColor,
                              '--color-border': indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        'flex flex-1 justify-between leading-none',
                        nestLabel ? 'items-end' : 'items-center',
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label ?? item.name}
                        </span>
                      </div>
                      {item.value != null && (
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {typeof item.value === 'number'
                            ? item.value.toLocaleString()
                            : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = 'bottom',
  nameKey,
}: React.ComponentProps<'div'> & {
  hideIcon?: boolean
  nameKey?: string
} & RechartsPrimitive.DefaultLegendContentProps) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload
        .filter((item) => item.type !== 'none')
        .map((item, index) => {
          const key = nameKey ?? toConfigKey(item.dataKey)
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={index}
              className={cn(
                '[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3',
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }

  const payloadPayload =
    'payload' in payload && typeof payload.payload === 'object' && payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (key in payload && typeof payload[key as keyof typeof payload] === 'string') {
    configLabelKey = payload[key as keyof typeof payload]
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === 'string'
  ) {
    configLabelKey = payloadPayload[key as keyof typeof payloadPayload]
  }

  return configLabelKey in config ? config[configLabelKey] : config[key]
}

/*
 * Axis ticks.
 *
 * Recharts centres every tick label on its tick, which is right for the ones in the
 * middle and wrong for the two on the ends: half of the first label falls left of
 * the plot area and half of the last one falls right of it, and the surface clips
 * both. Measured at 1280px with a formatted timestamp, that was 37px cut off the
 * first label and 29px off the last — on every chart in the app, not one of them.
 *
 * Widening the axis margins would also hide it, at the cost of that width on every
 * viewport, and it would still be a guess about the longest label in the longest
 * locale. Anchoring the end ticks to their end costs nothing.
 *
 * This lives here rather than at a call site because nothing about it is specific to
 * a chart. The first version was written into the dashboard panel, which fixed one
 * chart and left the other one clipped.
 */
function ChartAxisTick({
  x,
  y,
  payload,
  index,
  visibleTicksCount,
  textAnchor,
  tickFormatter,
}: {
  x?: number
  y?: number
  payload?: { value?: number | string }
  index?: number
  visibleTicksCount?: number
  textAnchor?: 'start' | 'middle' | 'end'
  tickFormatter?: (value: never, index: number) => string
}) {
  const tickIndex = index ?? 0
  const isFirst = tickIndex === 0
  const isLast = visibleTicksCount !== undefined && tickIndex === visibleTicksCount - 1
  const value = payload?.value
  const label = tickFormatter
    ? tickFormatter(value as never, tickIndex)
    : value === undefined
      ? ''
      : String(value)

  return (
    <text
      x={x}
      y={y}
      dy={12}
      /*
       * A single tick is treated as the first one: it sits at the left edge, so
       * starting there is what keeps it inside the plot.
       */
      textAnchor={isFirst ? 'start' : isLast ? 'end' : (textAnchor ?? 'middle')}
      /*
       * Set explicitly, not inherited. Recharts hands every tick its own `fill` of
       * `#666`, and the container's `fill-muted-foreground` rule only reaches the
       * default tick markup, so a custom tick that trusts either one ends up off
       * the theme.
       */
      fill="var(--muted-foreground)"
    >
      {label}
    </text>
  )
}

/**
 * `XAxis` with the shared tick treatment and the axis chrome this product uses
 * everywhere: no tick line, no axis line, one gap size. Pass `tick` to opt out.
 */
function ChartXAxis({ tick, ...props }: React.ComponentProps<typeof RechartsPrimitive.XAxis>) {
  return (
    <RechartsPrimitive.XAxis
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      {...props}
      tick={tick ?? <ChartAxisTick />}
    />
  )
}

export {
  ChartAxisTick,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
}
