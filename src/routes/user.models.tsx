import { createFileRoute } from '@tanstack/react-router'

import { UserModelCatalogPage } from '@/features/access/user-model-catalog-page'

export const Route = createFileRoute('/user/models')({
  component: UserModelCatalogPage,
})
