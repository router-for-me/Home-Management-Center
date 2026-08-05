import { createFileRoute } from '@tanstack/react-router'

import { UserModelCatalogPage } from '@/features/access/user-model-catalog-page'
import { normalizeUserModelRouteSearch } from '@/features/access/user-model-route'

export const Route = createFileRoute('/user/models')({
  component: UserModelCatalogPage,
  validateSearch: normalizeUserModelRouteSearch,
})
