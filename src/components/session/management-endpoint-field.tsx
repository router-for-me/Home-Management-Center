import { useTranslation } from 'react-i18next'

import { fieldClassName } from '@/components/shared/form-layout'
import { Input } from '@/components/ui/input'
import { SAME_ORIGIN_MANAGEMENT_BASE_URL } from '@/lib/api/management/client'
import { useSessionStore } from '@/stores/session-store'

type ManagementEndpointFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled: boolean
}

export function ManagementEndpointField({
  value,
  onChange,
  placeholder,
  disabled,
}: ManagementEndpointFieldProps) {
  const { t } = useTranslation()
  const detectedBaseUrl = useSessionStore((state) => state.detectedBaseUrl)
  const detectedSource = useSessionStore((state) => state.detectedSource)
  const detectedEndpoint =
    detectedSource === 'same-origin' ? SAME_ORIGIN_MANAGEMENT_BASE_URL : detectedBaseUrl
  const detectedEndpointLabel =
    detectedSource === 'same-origin'
      ? 'connectionDialog.detectedProxyEndpoint'
      : 'connectionDialog.detectedRuntime'

  return (
    <label className={fieldClassName}>
      <span>{t('connectionDialog.baseUrl')}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="url"
      />
      <span className="text-muted-foreground text-xs leading-5">
        {t('connectionDialog.baseUrlHintDev')}
      </span>
      {detectedBaseUrl ? (
        <span className="text-primary text-xs leading-5">
          {t(detectedEndpointLabel, {
            endpoint: detectedEndpoint,
          })}
        </span>
      ) : null}
    </label>
  )
}
