import { createFileRoute } from '@tanstack/react-router'

import { BillingWorkbenchPage } from '@/features/billing/billing-workbench-page'

export const Route = createFileRoute('/admin/billing')({
  component: BillingPage,
})

function BillingPage() {
  return <BillingWorkbenchPage />
}
