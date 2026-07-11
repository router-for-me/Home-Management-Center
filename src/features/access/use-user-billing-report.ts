import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'

import {
  type UserBillingFilters,
  type UserBillingPagination,
  fetchUserBillingCharges,
  fetchUserBillingOverview,
} from '@/lib/api/user/billing'
import { createLocalDateRange, createLocalMonthToDateRange } from '@/lib/billing/date-range'
import { useUserSessionStore } from '@/stores/user-session-store'

function toError(error: unknown) {
  if (error instanceof Error) return error
  if (
    typeof error === 'object' &&
    error !== null &&
    !Array.isArray(error) &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return new Error((error as { message: string }).message, { cause: error })
  }

  return new Error(String(error))
}

function createTodayRange(): UserBillingFilters {
  return createLocalDateRange(0)
}

function createCurrentMonthRange(): UserBillingFilters {
  return createLocalMonthToDateRange()
}

export function useUserBillingReport(
  filters: UserBillingFilters,
  pagination: UserBillingPagination,
) {
  const status = useUserSessionStore((state) => state.status)
  const baseUrl = useUserSessionStore((state) => state.baseUrl)
  const token = useUserSessionStore((state) => state.token)
  const authenticated = status === 'authenticated' && Boolean(token)
  const session = useMemo(
    () => ({
      baseUrl,
      token: token ?? '',
    }),
    [baseUrl, token],
  )

  const overviewQuery = useQuery({
    queryKey: ['userBilling', 'overview', baseUrl, token, filters],
    enabled: authenticated,
    queryFn: async () => {
      const [rangeOverview, todayOverview, monthOverview] = await Promise.all([
        fetchUserBillingOverview(session, filters),
        fetchUserBillingOverview(session, createTodayRange()),
        fetchUserBillingOverview(session, createCurrentMonthRange()),
      ])

      return {
        ...rangeOverview,
        overview: {
          ...rangeOverview.overview,
          todaySpend: todayOverview.overview.todaySpend,
          monthSpend: monthOverview.overview.monthSpend,
        },
      }
    },
  })

  const chargesQuery = useQuery({
    queryKey: ['userBilling', 'charges', baseUrl, token, filters, pagination],
    enabled: authenticated,
    queryFn: () => fetchUserBillingCharges(session, filters, pagination),
  })

  return {
    overview: overviewQuery.data?.overview ?? null,
    overviewLoading: overviewQuery.isLoading,
    overviewFetching: overviewQuery.isFetching,
    overviewError: overviewQuery.error ? toError(overviewQuery.error).message : null,
    charges: chargesQuery.data?.items ?? [],
    chargesTotal: chargesQuery.data?.total ?? 0,
    chargesLoading: chargesQuery.isLoading,
    chargesFetching: chargesQuery.isFetching,
    chargesError: chargesQuery.error ? toError(chargesQuery.error).message : null,
    refreshOverview: overviewQuery.refetch,
    refreshCharges: chargesQuery.refetch,
  }
}
