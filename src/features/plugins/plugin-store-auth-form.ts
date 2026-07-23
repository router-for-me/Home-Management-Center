import type {
  PluginStoreAuthCreateInput,
  PluginStoreAuthRule,
  PluginStoreAuthScope,
  PluginStoreAuthType,
  PluginStoreAuthUpdateInput,
} from '@/lib/api/management/plugin-store-auth'

export type PluginStoreAuthFormState = {
  name: string
  match: string
  applyTo: PluginStoreAuthScope[]
  authType: PluginStoreAuthType
  token: string
  username: string
  password: string
  headerName: string
  headerValue: string
  enabled: boolean
}

export type PluginStoreAuthFormField =
  | 'name'
  | 'match'
  | 'token'
  | 'username'
  | 'password'
  | 'headerName'
  | 'headerValue'

export type PluginStoreAuthFormError =
  | 'required'
  | 'httpsRequired'
  | 'invalidHeaderName'
  | 'credentialsRequired'

export type PluginStoreAuthFormErrors = Partial<
  Record<PluginStoreAuthFormField, PluginStoreAuthFormError>
>

export function createPluginStoreAuthFormState(
  rule: PluginStoreAuthRule | null,
): PluginStoreAuthFormState {
  return {
    name: rule?.name ?? '',
    match: rule?.match ?? '',
    applyTo: rule?.applyTo ?? [],
    authType: rule?.authType ?? 'bearer',
    token: '',
    username: '',
    password: '',
    headerName: rule?.headerName ?? '',
    headerValue: '',
    enabled: rule?.enabled ?? true,
  }
}

function isValidPluginStoreAuthMatch(value: string) {
  const trimmed = value.trim()
  if (trimmed.includes('?') || trimmed.includes('#')) return false

  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
  } catch {
    return false
  }
}

const httpHeaderNamePattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export function canRetainPluginStoreAuthCredentials(
  state: PluginStoreAuthFormState,
  currentRule: PluginStoreAuthRule | null,
) {
  return Boolean(
    currentRule &&
    state.authType !== 'none' &&
    state.authType === currentRule.authType &&
    currentRule.credentialsConfigured,
  )
}

export function validatePluginStoreAuthForm(
  state: PluginStoreAuthFormState,
  currentRule: PluginStoreAuthRule | null,
): PluginStoreAuthFormErrors {
  const errors: PluginStoreAuthFormErrors = {}
  const requireCredentials =
    state.authType !== 'none' && !canRetainPluginStoreAuthCredentials(state, currentRule)

  if (!state.name.trim()) errors.name = 'required'
  if (!state.match.trim()) errors.match = 'required'
  else if (!isValidPluginStoreAuthMatch(state.match)) errors.match = 'httpsRequired'

  if (state.authType === 'bearer' || state.authType === 'github-token') {
    if (requireCredentials && !state.token) errors.token = 'credentialsRequired'
  }

  if (state.authType === 'basic') {
    if (requireCredentials && !state.username) errors.username = 'credentialsRequired'
    if (requireCredentials && !state.password) errors.password = 'credentialsRequired'
  }

  if (state.authType === 'header') {
    if (!state.headerName.trim()) errors.headerName = 'required'
    else if (!httpHeaderNamePattern.test(state.headerName.trim())) {
      errors.headerName = 'invalidHeaderName'
    }
    if (requireCredentials && !state.headerValue) errors.headerValue = 'credentialsRequired'
  }

  return errors
}

export function hasPluginStoreAuthFormErrors(errors: PluginStoreAuthFormErrors) {
  return Object.keys(errors).length > 0
}

function secretFields(state: PluginStoreAuthFormState) {
  switch (state.authType) {
    case 'bearer':
    case 'github-token':
      return state.token ? { token: state.token } : {}
    case 'basic':
      return {
        ...(state.username ? { username: state.username } : {}),
        ...(state.password ? { password: state.password } : {}),
      }
    case 'header':
      return state.headerValue ? { headerValue: state.headerValue } : {}
    default:
      return {}
  }
}

export function toPluginStoreAuthCreateInput(
  state: PluginStoreAuthFormState,
): PluginStoreAuthCreateInput {
  return {
    name: state.name.trim(),
    match: state.match.trim(),
    applyTo: state.applyTo,
    authType: state.authType,
    headerName: state.authType === 'header' ? state.headerName.trim() : undefined,
    enabled: state.enabled,
    ...secretFields(state),
  }
}

export function toPluginStoreAuthUpdateInput(
  state: PluginStoreAuthFormState,
): PluginStoreAuthUpdateInput {
  return {
    name: state.name.trim(),
    match: state.match.trim(),
    applyTo: state.applyTo,
    authType: state.authType,
    headerName: state.authType === 'header' ? state.headerName.trim() : '',
    enabled: state.enabled,
    ...secretFields(state),
  }
}
