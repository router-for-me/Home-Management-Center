import { createFileRoute } from '@tanstack/react-router'

import { CallDiagnosticsPage } from '@/features/call-diagnostics/call-diagnostics-page'

export const Route = createFileRoute('/admin/diagnostics')({
  component: DiagnosticsPage,
})

function DiagnosticsPage() {
  return <CallDiagnosticsPage />
}
