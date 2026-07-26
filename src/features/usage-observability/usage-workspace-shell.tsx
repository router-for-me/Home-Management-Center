import type { ReactNode } from 'react'

import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { UsageWorkspaceView } from '@/features/usage-observability/usage-route'

const usageWorkspaceViews: UsageWorkspaceView[] = ['overview', 'requests']

export function UsageWorkspaceShell({
  view,
  header,
  children,
  onViewChange,
}: {
  view: UsageWorkspaceView
  header?: ReactNode
  children: ReactNode
  onViewChange: (view: UsageWorkspaceView) => void
}) {
  const { t } = useTranslation()

  return (
    <Tabs
      value={view}
      className="grid w-full gap-4"
      onValueChange={(value) => onViewChange(value as UsageWorkspaceView)}
    >
      {header ?? null}

      <TabsList aria-label={t('usagePage.tabs.label')}>
        {usageWorkspaceViews.map((item) => (
          <TabsTrigger key={item} value={item} className="min-w-32">
            {t(`usagePage.tabs.${item}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      {usageWorkspaceViews.map((item) => (
        <TabsContent
          key={item}
          value={item}
          forceMount
          className="grid min-w-0 gap-4 data-[state=inactive]:hidden"
        >
          {view === item ? children : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}
