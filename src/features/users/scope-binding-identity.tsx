import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyValueButton } from '@/components/shared/diagnostic-detail'
import { ModelLogo, ProviderLogo } from '@/components/shared/provider-logo'
import { getCredentialProviderLabel } from '@/features/credentials/credential-display'
import type { ChannelGroupCredential } from '@/lib/api/management/access-groups'

export function ScopeCredentialIdentity({
  authId,
  displayName,
  provider,
  state,
  showId,
  copyable,
}: {
  authId: string
  displayName?: string | null
  provider?: string | null
  state?: ChannelGroupCredential['state'] | 'unresolved'
  showId: boolean
  copyable?: boolean
}) {
  const { t } = useTranslation()
  const name = displayName && displayName !== authId ? displayName : null

  return (
    <span className="flex min-w-0 items-center gap-2">
      {provider ? (
        <ProviderLogo providerId={provider} size="sm" />
      ) : (
        <KeyRound className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
      )}
      <span className="grid min-w-0 gap-0.5">
        <span className="flex min-w-0 items-center gap-1">
          {name ? (
            <span className="text-label truncate" title={name}>
              {name}
            </span>
          ) : (
            <code className="text-code truncate select-all" title={authId}>
              {authId}
            </code>
          )}
          {copyable && (
            <CopyValueButton
              value={authId}
              copyLabel={t('usersPage.groups.copyCredentialId', { id: authId })}
              copiedLabel={t('usersPage.groups.credentialIdCopied')}
            />
          )}
        </span>
        {(provider || state) && (
          <span className="text-meta text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2">
            {provider && (
              <span className="truncate">{getCredentialProviderLabel(t, provider)}</span>
            )}
            {state && (
              <span className="text-warning-foreground dark:text-warning">
                {t(`usersPage.groups.credentialState.${state}`)}
              </span>
            )}
          </span>
        )}
        {name && showId && (
          <code className="text-code text-muted-foreground truncate select-all" title={authId}>
            {authId}
          </code>
        )}
      </span>
    </span>
  )
}

export function ScopeModelIdentity({
  modelId,
  displayName,
}: {
  modelId: string
  displayName?: string
}) {
  const name = displayName && displayName !== modelId ? displayName : null

  return (
    <span className="flex min-w-0 items-center gap-2">
      <ModelLogo modelId={modelId} displayName={displayName} size="sm" />
      <span className="grid min-w-0 gap-0.5">
        {name && (
          <span className="text-label truncate" title={name}>
            {name}
          </span>
        )}
        <code
          className={name ? 'text-code text-muted-foreground truncate' : 'text-code truncate'}
          title={modelId}
        >
          {modelId}
        </code>
      </span>
    </span>
  )
}
