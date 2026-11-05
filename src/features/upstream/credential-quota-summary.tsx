import type { ComponentProps } from 'react'

import { UpstreamQuotaCell } from './quota-cells'
import { useQuotaPreview } from './use-quota-preview'

export function CredentialQuotaSummary(props: ComponentProps<typeof UpstreamQuotaCell>) {
  const preview = useQuotaPreview(props.state.kind === 'entry' ? props.state.entry : null)
  return (
    <div ref={preview.ref} className="min-w-0">
      <UpstreamQuotaCell
        {...props}
        detailLoading={preview.loading}
        detailFailed={preview.failed}
        state={
          props.state.kind === 'entry' && preview.entry
            ? { ...props.state, entry: preview.entry }
            : props.state
        }
      />
    </div>
  )
}
