import { useMemo, useRef, useState } from 'react'

import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DrawerScaffoldBody,
  DrawerScaffoldContent,
  DrawerScaffoldFooter,
  DrawerScaffoldHeader,
} from '@/components/shared/drawer-scaffold'
import { fieldClassName, formGridClassName } from '@/components/shared/form-layout'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { controlSizeClassNames } from '@/components/ui/control-size'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  type PluginStoreAuthFormErrors,
  type PluginStoreAuthFormField,
  type PluginStoreAuthFormState,
  canRetainPluginStoreAuthCredentials,
  createPluginStoreAuthFormState,
  hasPluginStoreAuthFormErrors,
  toPluginStoreAuthCreateInput,
  toPluginStoreAuthUpdateInput,
  validatePluginStoreAuthForm,
} from '@/features/plugins/plugin-store-auth-form'
import { usePluginStoreAuth } from '@/features/plugins/use-plugin-store-auth'
import {
  type PluginStoreAuthRule,
  type PluginStoreAuthScope,
  type PluginStoreAuthType,
  pluginStoreAuthScopes,
  pluginStoreAuthTypes,
} from '@/lib/api/management/plugin-store-auth'
import { cn } from '@/lib/utils'

type EditorTarget = PluginStoreAuthRule | 'new' | null

const badgeClassName = 'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error)
}

function SecretInput({
  id,
  value,
  disabled,
  placeholder,
  error,
  onChange,
}: {
  id: string
  value: string
  disabled: boolean
  placeholder: string
  error?: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Input
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="new-password"
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className="pr-10 font-mono"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="text"
          size="icon-md"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          disabled={disabled}
          aria-label={t(
            revealed ? 'pluginPage.auth.secret.hideValue' : 'pluginPage.auth.secret.showValue',
          )}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      {error ? (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PluginStoreAuthHeader({
  editorTarget,
  saving,
  onBack,
}: {
  editorTarget: EditorTarget
  saving: boolean
  onBack: () => void
}) {
  const { t } = useTranslation()

  return (
    <DrawerScaffoldHeader
      back={
        editorTarget
          ? {
              label: t('pluginPage.auth.actions.back'),
              onClick: onBack,
              disabled: saving,
            }
          : undefined
      }
    >
      <SheetTitle className="truncate">
        {editorTarget
          ? t(
              editorTarget === 'new'
                ? 'pluginPage.auth.form.createTitle'
                : 'pluginPage.auth.form.editTitle',
            )
          : t('pluginPage.auth.title')}
      </SheetTitle>
      <SheetDescription className={editorTarget ? 'sr-only' : undefined}>
        {t('pluginPage.auth.description')}
      </SheetDescription>
    </DrawerScaffoldHeader>
  )
}

export function PluginStoreAuthEditor({
  target,
  saving,
  onCancel,
  onSave,
}: {
  target: Exclude<EditorTarget, null>
  saving: boolean
  onCancel: () => void
  onSave: (
    state: PluginStoreAuthFormState,
    currentRule: PluginStoreAuthRule | null,
  ) => Promise<void>
}) {
  const { t } = useTranslation()
  const currentRule = target === 'new' ? null : target
  const [state, setState] = useState(() => createPluginStoreAuthFormState(currentRule))
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const errors = useMemo(
    () => (submitted ? validatePluginStoreAuthForm(state, currentRule) : {}),
    [currentRule, state, submitted],
  )

  const update = (patch: Partial<PluginStoreAuthFormState>) => {
    setState((current) => ({ ...current, ...patch }))
    setSaveError(null)
  }

  const toggleScope = (scope: PluginStoreAuthScope) => {
    update({
      applyTo: state.applyTo.includes(scope)
        ? state.applyTo.filter((current) => current !== scope)
        : [...state.applyTo, scope],
    })
  }

  const changeAuthType = (authType: PluginStoreAuthType) => {
    update({ authType, token: '', username: '', password: '', headerValue: '' })
  }

  const errorText = (
    field: PluginStoreAuthFormField,
    values: PluginStoreAuthFormErrors = errors,
  ) => {
    const error = values[field]
    if (!error) return undefined
    return t(`pluginPage.auth.validation.${error}`)
  }

  const handleSubmit = async () => {
    const nextErrors = validatePluginStoreAuthForm(state, currentRule)
    setSubmitted(true)
    if (hasPluginStoreAuthFormErrors(nextErrors)) return

    try {
      await onSave(state, currentRule)
    } catch (error) {
      setSaveError(getErrorMessage(error))
    }
  }

  const canRetainStoredCredentials = canRetainPluginStoreAuthCredentials(state, currentRule)

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      aria-busy={saving}
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
    >
      <DrawerScaffoldBody
        data-slot="plugin-auth-editor-content"
        className="grid content-start gap-4"
      >
        <div className="border-info/30 bg-info/10 text-info rounded-md border p-3 text-sm leading-6">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t('pluginPage.auth.form.writeOnlyHint')}</span>
          </div>
        </div>

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2" htmlFor="plugin-auth-name">
            <span className="text-sm font-medium">{t('pluginPage.auth.fields.name')}</span>
            <Input
              id="plugin-auth-name"
              autoFocus
              value={state.name}
              disabled={saving}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'plugin-auth-name-error' : undefined}
              placeholder={t('pluginPage.auth.placeholders.name')}
              onChange={(event) => update({ name: event.target.value })}
            />
            {errorText('name') ? (
              <span id="plugin-auth-name-error" className="text-destructive text-xs">
                {errorText('name')}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1.5 sm:col-span-2" htmlFor="plugin-auth-match">
            <span className="text-sm font-medium">{t('pluginPage.auth.fields.match')}</span>
            <Input
              id="plugin-auth-match"
              value={state.match}
              disabled={saving}
              aria-invalid={Boolean(errors.match)}
              aria-describedby="plugin-auth-match-help"
              className="font-mono"
              placeholder={t('pluginPage.auth.placeholders.match')}
              onChange={(event) => update({ match: event.target.value })}
            />
            {errorText('match') ? (
              <span id="plugin-auth-match-help" className="text-destructive text-xs">
                {errorText('match')}
              </span>
            ) : (
              <span id="plugin-auth-match-help" className="text-muted-foreground text-xs leading-5">
                {t('pluginPage.auth.form.matchHint')}
              </span>
            )}
          </label>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="plugin-auth-type">
              {t('pluginPage.auth.fields.authType')}
            </label>
            <Select
              value={state.authType}
              disabled={saving}
              onValueChange={(value) => changeAuthType(value as PluginStoreAuthType)}
            >
              <SelectTrigger
                id="plugin-auth-type"
                aria-label={t('pluginPage.auth.fields.authType')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pluginStoreAuthTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`pluginPage.auth.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="plugin-auth-enabled">
              {t('pluginPage.auth.fields.enabled')}
            </label>
            <div
              data-slot="plugin-auth-enabled-control"
              className={cn(
                'border-input bg-background dark:bg-input/30 flex items-center justify-between gap-3 rounded-md border px-3 shadow-xs',
                controlSizeClassNames.lg,
              )}
            >
              <span className="text-sm">
                {t(
                  state.enabled
                    ? 'pluginPage.auth.status.enabled'
                    : 'pluginPage.auth.status.disabled',
                )}
              </span>
              <Switch
                id="plugin-auth-enabled"
                checked={state.enabled}
                disabled={saving}
                onCheckedChange={(checked) => update({ enabled: checked })}
              />
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">{t('pluginPage.auth.fields.applyTo')}</legend>
          <div data-slot="plugin-auth-apply-to-control" className="mt-1.5 grid gap-1.5">
            <div className="flex flex-wrap gap-2">
              {pluginStoreAuthScopes.map((scope) => (
                <label
                  key={scope}
                  className={cn(
                    'border-input bg-background flex items-center gap-2 rounded-md border px-3 text-sm',
                    controlSizeClassNames.lg,
                  )}
                >
                  <Checkbox
                    checked={state.applyTo.includes(scope)}
                    disabled={saving}
                    onCheckedChange={() => toggleScope(scope)}
                  />
                  <span>{t(`pluginPage.auth.scopes.${scope}`)}</span>
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              {t('pluginPage.auth.form.applyToHint')}
            </p>
          </div>
        </fieldset>

        {canRetainStoredCredentials ? (
          <div className="border-success/30 bg-success/10 text-success rounded-md border p-3 text-sm">
            {t('pluginPage.auth.form.credentialsRetainedHint')}
          </div>
        ) : null}

        {state.authType === 'bearer' || state.authType === 'github-token' ? (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="plugin-auth-token">
              {t('pluginPage.auth.fields.token')}
            </label>
            <SecretInput
              id="plugin-auth-token"
              value={state.token}
              disabled={saving}
              error={errorText('token')}
              placeholder={t(
                canRetainStoredCredentials
                  ? 'pluginPage.auth.placeholders.secretRetain'
                  : 'pluginPage.auth.placeholders.token',
              )}
              onChange={(token) => update({ token })}
            />
          </div>
        ) : null}

        {state.authType === 'basic' ? (
          <div className={formGridClassName}>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="plugin-auth-username">
                {t('pluginPage.auth.fields.username')}
              </label>
              <SecretInput
                id="plugin-auth-username"
                value={state.username}
                disabled={saving}
                error={errorText('username')}
                placeholder={t(
                  canRetainStoredCredentials
                    ? 'pluginPage.auth.placeholders.secretRetain'
                    : 'pluginPage.auth.placeholders.username',
                )}
                onChange={(username) => update({ username })}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="plugin-auth-password">
                {t('pluginPage.auth.fields.password')}
              </label>
              <SecretInput
                id="plugin-auth-password"
                value={state.password}
                disabled={saving}
                error={errorText('password')}
                placeholder={t(
                  canRetainStoredCredentials
                    ? 'pluginPage.auth.placeholders.secretRetain'
                    : 'pluginPage.auth.placeholders.password',
                )}
                onChange={(password) => update({ password })}
              />
            </div>
          </div>
        ) : null}

        {state.authType === 'header' ? (
          <div className={formGridClassName}>
            <label className={fieldClassName} htmlFor="plugin-auth-header-name">
              <span className="text-sm font-medium">{t('pluginPage.auth.fields.headerName')}</span>
              <Input
                id="plugin-auth-header-name"
                value={state.headerName}
                disabled={saving}
                aria-invalid={Boolean(errors.headerName)}
                aria-describedby={errors.headerName ? 'plugin-auth-header-name-error' : undefined}
                className="font-mono"
                placeholder={t('pluginPage.auth.placeholders.headerName')}
                onChange={(event) => update({ headerName: event.target.value })}
              />
              {errorText('headerName') ? (
                <span id="plugin-auth-header-name-error" className="text-destructive text-xs">
                  {errorText('headerName')}
                </span>
              ) : null}
            </label>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="plugin-auth-header-value">
                {t('pluginPage.auth.fields.headerValue')}
              </label>
              <SecretInput
                id="plugin-auth-header-value"
                value={state.headerValue}
                disabled={saving}
                error={errorText('headerValue')}
                placeholder={t(
                  canRetainStoredCredentials
                    ? 'pluginPage.auth.placeholders.secretRetain'
                    : 'pluginPage.auth.placeholders.headerValue',
                )}
                onChange={(headerValue) => update({ headerValue })}
              />
            </div>
          </div>
        ) : null}

        {saveError ? (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm leading-6"
          >
            {saveError}
          </div>
        ) : null}
      </DrawerScaffoldBody>

      <DrawerScaffoldFooter className="flex-col-reverse">
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t(currentRule ? 'pluginPage.auth.actions.save' : 'pluginPage.auth.actions.create')}
        </Button>
      </DrawerScaffoldFooter>
    </form>
  )
}

export function PluginStoreAuthSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const auth = usePluginStoreAuth(open)
  const [editorTarget, setEditorTarget] = useState<EditorTarget>(null)
  const [deleteTarget, setDeleteTarget] = useState<PluginStoreAuthRule | null>(null)
  const editorRequest = useRef(0)

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && (auth.isSaving || auth.deletingId !== null)) return
    if (!nextOpen) {
      editorRequest.current += 1
      setEditorTarget(null)
      setDeleteTarget(null)
    }
    onOpenChange(nextOpen)
  }

  const createRule = () => {
    editorRequest.current += 1
    setEditorTarget('new')
  }

  const editRule = async (rule: PluginStoreAuthRule) => {
    const request = editorRequest.current + 1
    editorRequest.current = request
    try {
      const currentRule = await auth.loadRule(rule.id)
      if (editorRequest.current === request) setEditorTarget(currentRule)
    } catch (error) {
      if (editorRequest.current === request) toast.error(getErrorMessage(error))
    }
  }

  const saveRule = async (
    state: PluginStoreAuthFormState,
    currentRule: PluginStoreAuthRule | null,
  ) => {
    if (currentRule) {
      await auth.updateRule(currentRule.id, toPluginStoreAuthUpdateInput(state))
      toast.success(t('pluginPage.auth.toast.updated', { name: state.name.trim() }))
    } else {
      await auth.createRule(toPluginStoreAuthCreateInput(state))
      toast.success(t('pluginPage.auth.toast.created', { name: state.name.trim() }))
    }
    setEditorTarget(null)
  }

  const deleteRule = async () => {
    if (!deleteTarget) return
    try {
      await auth.deleteRule(deleteTarget.id)
      toast.success(t('pluginPage.auth.toast.deleted', { name: deleteTarget.name }))
      setDeleteTarget(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={changeOpen}>
        <DrawerScaffoldContent
          className="sm:max-w-2xl"
          showCloseButton={!auth.isSaving && auth.deletingId === null}
        >
          <PluginStoreAuthHeader
            editorTarget={editorTarget}
            saving={auth.isSaving}
            onBack={() => setEditorTarget(null)}
          />

          {editorTarget ? (
            <PluginStoreAuthEditor
              key={editorTarget === 'new' ? 'new' : editorTarget.id}
              target={editorTarget}
              saving={auth.isSaving}
              onCancel={() => setEditorTarget(null)}
              onSave={saveRule}
            />
          ) : (
            <DrawerScaffoldBody className="grid content-start gap-4 pb-6">
              {auth.isPending ? (
                <div className="grid gap-3">
                  <Skeleton className="h-24 rounded-md" />
                  <Skeleton className="h-24 rounded-md" />
                </div>
              ) : auth.isUnsupported ? (
                <div className="border-info/30 bg-info/10 rounded-md border p-4">
                  <p className="font-medium">{t('pluginPage.auth.unsupported.title')}</p>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {t('pluginPage.auth.unsupported.description')}
                  </p>
                </div>
              ) : auth.isError ? (
                <div className="border-destructive/30 bg-destructive/10 rounded-md border p-4">
                  <p className="text-destructive font-medium">{t('pluginPage.auth.error.title')}</p>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {auth.error?.message ?? t('pluginPage.auth.error.description')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="mt-3"
                    disabled={auth.isFetching}
                    onClick={() => void auth.refetch()}
                  >
                    {auth.isFetching ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden="true" />
                    )}
                    {t('pluginPage.actions.refresh')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="border-info/30 bg-info/10 text-info rounded-md border p-3 text-sm leading-6">
                    <div className="flex items-start gap-2">
                      <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{t('pluginPage.auth.orderHint')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{t('pluginPage.auth.list.title')}</p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {t('pluginPage.auth.list.count', { count: auth.rules.length })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="md"
                      disabled={auth.loadingRuleId !== null}
                      onClick={createRule}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {t('pluginPage.auth.actions.add')}
                    </Button>
                  </div>

                  {auth.rules.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center">
                      <KeyRound
                        className="text-muted-foreground mx-auto size-6"
                        aria-hidden="true"
                      />
                      <p className="mt-3 font-medium">{t('pluginPage.auth.empty.title')}</p>
                      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">
                        {t('pluginPage.auth.empty.description')}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {auth.rules.map((rule, index) => (
                        <div key={rule.id} className="grid gap-3 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-muted-foreground font-mono text-xs">
                                  {t('pluginPage.auth.list.order', { order: index + 1 })}
                                </span>
                                <span className="font-medium">{rule.name}</span>
                              </div>
                              <p className="text-muted-foreground mt-1 font-mono text-xs leading-5 break-all">
                                {rule.match}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                variant="text"
                                size="md"
                                disabled={auth.loadingRuleId !== null}
                                onClick={() => void editRule(rule)}
                              >
                                {auth.loadingRuleId === rule.id ? (
                                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Pencil className="size-4" aria-hidden="true" />
                                )}
                                {t('pluginPage.auth.actions.edit')}
                              </Button>
                              <Button
                                type="button"
                                variant="destructiveText"
                                size="md"
                                disabled={auth.loadingRuleId !== null}
                                onClick={() => setDeleteTarget(rule)}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                                {t('pluginPage.auth.actions.delete')}
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={cn(badgeClassName, 'border-border bg-muted')}>
                              {t(`pluginPage.auth.types.${rule.authType}`)}
                            </span>
                            <span
                              className={cn(
                                badgeClassName,
                                rule.enabled
                                  ? 'border-success/30 bg-success/10 text-success'
                                  : 'border-border bg-muted text-muted-foreground',
                              )}
                            >
                              {t(
                                rule.enabled
                                  ? 'pluginPage.auth.status.enabled'
                                  : 'pluginPage.auth.status.disabled',
                              )}
                            </span>
                            <span
                              className={cn(
                                badgeClassName,
                                rule.authType === 'none' || rule.credentialsConfigured
                                  ? 'border-success/30 bg-success/10 text-success'
                                  : 'border-warning/35 bg-warning/10 text-warning-foreground dark:text-warning',
                              )}
                            >
                              {t(
                                rule.authType === 'none'
                                  ? 'pluginPage.auth.status.notRequired'
                                  : rule.credentialsConfigured
                                    ? 'pluginPage.auth.status.configured'
                                    : 'pluginPage.auth.status.missing',
                              )}
                            </span>
                          </div>

                          <p className="text-muted-foreground text-xs leading-5">
                            {rule.applyTo.length
                              ? rule.applyTo
                                  .map((scope) => t(`pluginPage.auth.scopes.${scope}`))
                                  .join(' · ')
                              : t('pluginPage.auth.scopes.all')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </DrawerScaffoldBody>
          )}
        </DrawerScaffoldContent>
      </Sheet>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && auth.deletingId === null && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pluginPage.auth.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pluginPage.auth.delete.description', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={auth.deletingId !== null}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
              disabled={auth.deletingId !== null}
              onClick={(event) => {
                event.preventDefault()
                void deleteRule()
              }}
            >
              {auth.deletingId !== null ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              {t('pluginPage.auth.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
