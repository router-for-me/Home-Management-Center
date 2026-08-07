import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Placeholder for a route whose component chunk is still in flight. Routes are
 * code-split, so a navigation can now wait on a network round trip that used to
 * be part of the entry bundle.
 */
export function RoutePending() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4 p-6" role="status" aria-busy="true" aria-label={t('routeLoading')}>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
