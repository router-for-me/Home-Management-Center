import { useId } from 'react'

import { useTranslation } from 'react-i18next'

import { fieldClassName, formGridClassName } from '@/components/shared/form-layout'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type ProviderConnectionPool,
  connectionPoolIssues,
} from '@/lib/api/management/provider-connection-pool'

export function ProviderConnectionPoolEditor({
  value,
  group,
  groupKeyCount,
  disabled,
  onChange,
}: {
  value: ProviderConnectionPool
  group?: ProviderConnectionPool
  groupKeyCount?: number
  disabled: boolean
  onChange: (next: ProviderConnectionPool) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const keyScope = group !== undefined
  const title = t(keyScope ? 'providersPage.pool.key' : 'providersPage.pool.group')
  const label = (mode: ProviderConnectionPool['mode']) => {
    switch (mode) {
      case 'absent':
        return t(keyScope ? 'providersPage.pool.inherit' : 'providersPage.pool.unconfigured')
      case 'configured':
        return t(keyScope ? 'providersPage.pool.parameters' : 'providersPage.pool.on')
      case 'enabled':
        return t('providersPage.pool.forceOn')
      case 'disabled':
        return t(keyScope ? 'providersPage.pool.optOut' : 'providersPage.pool.off')
      case 'unsupported':
        return t('providersPage.pool.unsupported')
    }
  }
  const modes = keyScope
    ? (['absent', 'configured', 'enabled', 'disabled'] as const)
    : (['absent', 'configured', 'disabled'] as const)
  const configured = value.mode !== 'absent' && value.mode !== 'unsupported'
  const inherited = group?.mode === 'absent' ? undefined : group
  const issues = connectionPoolIssues(value)
  return (
    <div role="group" aria-labelledby={id} className="grid min-w-0 gap-2">
      <div className={fieldClassName}>
        <label id={id} htmlFor={`${id}-mode`}>
          {title}
        </label>
        {value.mode === 'unsupported' ? (
          <p className="text-muted-foreground text-xs font-normal">{label('unsupported')}</p>
        ) : (
          <Select
            value={!keyScope && value.mode === 'enabled' ? 'configured' : value.mode}
            onValueChange={(mode: ProviderConnectionPool['mode']) => onChange({ ...value, mode })}
            disabled={disabled}
          >
            <SelectTrigger
              id={`${id}-mode`}
              aria-labelledby={id}
              aria-describedby={!keyScope ? `${id}-scope` : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modes.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {label(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!keyScope && (
          <p id={`${id}-scope`} className="text-muted-foreground text-xs leading-5 font-normal">
            {groupKeyCount !== undefined && groupKeyCount > 1 && (
              <>{t('providersPage.pool.groupSize', { total: groupKeyCount })} </>
            )}
            {t('providersPage.pool.groupHint')}
          </p>
        )}
      </div>
      {configured && (
        <>
          <div className={formGridClassName}>
            <label className={fieldClassName}>
              <span>{t('providersPage.pool.timeout')}</span>
              <Input
                value={value.idleTimeout}
                disabled={disabled}
                placeholder={
                  inherited?.mode === 'unsupported'
                    ? label('absent')
                    : inherited?.idleTimeout.trim() || '300s'
                }
                aria-invalid={Boolean(issues.idleTimeout)}
                aria-describedby={issues.idleTimeout ? `${id}-timeout-error` : `${id}-hint`}
                onChange={(e) => onChange({ ...value, idleTimeout: e.target.value })}
              />
              {issues.idleTimeout && (
                <span id={`${id}-timeout-error`} className="text-destructive text-xs font-normal">
                  {t('providersPage.pool.invalidTimeout')}
                </span>
              )}
            </label>
            <label className={fieldClassName}>
              <span>{t('providersPage.pool.maxIdle')}</span>
              <Input
                value={value.maxIdle}
                disabled={disabled}
                placeholder={
                  inherited?.mode === 'unsupported'
                    ? label('absent')
                    : inherited?.maxIdle.trim() || '2'
                }
                aria-invalid={Boolean(issues.maxIdle)}
                aria-describedby={issues.maxIdle ? `${id}-count-error` : `${id}-hint`}
                onChange={(e) => onChange({ ...value, maxIdle: e.target.value })}
              />
              {issues.maxIdle && (
                <span id={`${id}-count-error`} className="text-destructive text-xs font-normal">
                  {t('providersPage.pool.invalidCount')}
                </span>
              )}
            </label>
          </div>
          <p id={`${id}-hint`} className="text-muted-foreground text-xs leading-5">
            {t(keyScope ? 'providersPage.pool.keyHint' : 'providersPage.pool.defaults')}{' '}
            {keyScope &&
              value.mode === 'configured' &&
              group.mode === 'absent' &&
              t('providersPage.pool.defaultOptIn')}{' '}
            {t('providersPage.pool.nonpositive')}
          </p>
        </>
      )}
    </div>
  )
}
