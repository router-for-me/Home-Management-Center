import { type FormEvent, useEffect, useRef, useState } from 'react'

import { Link, useNavigate } from '@tanstack/react-router'

import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Copy,
  Edit3,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PublicAccessShell } from '@/components/public/public-access-shell'
import { TableEmptyState } from '@/components/shared/empty-state'
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
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { UserApiKeyInput, UserApiKeyResource } from '@/lib/api/user/api-keys'
import type { UserEmailStatus, UserPasskeyResource } from '@/lib/api/user/auth'
import { formatCreditAmount } from '@/lib/billing/amount-format'
import { embeddedEntryLinks } from '@/lib/embedded-entry-links'
import { useUserSessionStore } from '@/stores/user-session-store'

import { useUserWorkspace } from './use-user-workspace'
import { UserBillingReport } from './user-billing-report'
import { userSecurityErrorMessage } from './user-security-errors'

type KeySheetMode = { type: 'create' } | { type: 'edit'; resource: UserApiKeyResource }
type SecurityDeleteTarget = { type: 'totp' } | { type: 'passkey'; passkey: UserPasskeyResource }

function formatOptionalTime(value: string | null, fallback: string) {
  if (!value) return fallback

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function scopeLabel(resource: UserApiKeyResource, fallback: string) {
  const parts = [
    ...resource.channelGroupIds.map((id) => `C#${id}`),
    ...resource.modelGroupIds.map((id) => `M#${id}`),
  ]

  return parts.length > 0 ? parts.join(', ') : fallback
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
  }
}

function ApiKeyForm({
  mode,
  mutating,
  onCancel,
  onSubmit,
}: {
  mode: KeySheetMode
  mutating: boolean
  onCancel: () => void
  onSubmit: (input: UserApiKeyInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [keyValue, setKeyValue] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setLocalError(null)
    setKeyValue(mode.type === 'edit' ? mode.resource.key : '')
  }, [mode])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (mode.type === 'edit' && !keyValue.trim()) {
      setLocalError(t('userWorkspace.keys.validation.keyRequired'))
      return
    }

    try {
      setLocalError(null)
      await onSubmit({ key: keyValue.trim() || undefined })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <form className="grid gap-5 p-5" onSubmit={(event) => void handleSubmit(event)}>
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('userWorkspace.keys.form.key')}</span>
        <Input
          value={keyValue}
          disabled={mutating}
          placeholder={
            mode.type === 'create'
              ? t('userWorkspace.keys.form.keyCreatePlaceholder')
              : t('userWorkspace.keys.form.keyEditPlaceholder')
          }
          onChange={(event) => setKeyValue(event.target.value)}
        />
        <span className="text-muted-foreground text-xs leading-5">
          {mode.type === 'create'
            ? t('userWorkspace.keys.form.generatedHint')
            : t('userWorkspace.keys.form.editHint')}
        </span>
      </label>
      {localError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {localError}
        </div>
      ) : null}
      <SheetFooter className="p-0">
        <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutating}>
          {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode.type === 'create'
            ? t('userWorkspace.keys.actions.create')
            : t('userWorkspace.keys.actions.save')}
        </Button>
      </SheetFooter>
    </form>
  )
}

function ApiKeysTable({
  keys,
  loading,
  onCopy,
  onEdit,
  onDelete,
}: {
  keys: UserApiKeyResource[]
  loading: boolean
  onCopy: (resource: UserApiKeyResource) => void
  onEdit: (resource: UserApiKeyResource) => void
  onDelete: (resource: UserApiKeyResource) => void
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="grid gap-2 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (keys.length === 0) {
    return (
      <TableEmptyState
        kind="empty"
        className="m-0 border-0"
        title={t('userWorkspace.keys.empty')}
      />
    )
  }

  return (
    <Table className="min-w-[760px]">
      <TableHeader className="bg-muted/70 text-muted-foreground">
        <TableRow variant="static">
          <TableHead>{t('userWorkspace.keys.table.key')}</TableHead>
          <TableHead>{t('userWorkspace.keys.table.scope')}</TableHead>
          <TableHead>{t('userWorkspace.keys.table.updatedAt')}</TableHead>
          <TableHead className="w-[220px] text-right">
            {t('userWorkspace.keys.table.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((resource) => (
          <TableRow key={resource.id ?? resource.key} variant="resource">
            <TableCell>
              <span className="font-mono text-xs">{resource.maskedKey}</span>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-[220px] truncate">
              {scopeLabel(resource, t('userWorkspace.keys.unrestricted'))}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatOptionalTime(resource.updatedAt, t('userWorkspace.summary.notAvailable'))}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1.5">
                <Button variant="text" size="sm" className="px-2" onClick={() => onCopy(resource)}>
                  <Copy className="size-4" aria-hidden="true" />
                  {t('userWorkspace.keys.actions.copy')}
                </Button>
                <Button variant="text" size="sm" className="px-2" onClick={() => onEdit(resource)}>
                  <Edit3 className="size-4" aria-hidden="true" />
                  {t('userWorkspace.keys.actions.edit')}
                </Button>
                <Button
                  variant="destructiveText"
                  size="sm"
                  className="px-2"
                  onClick={() => onDelete(resource)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t('userWorkspace.keys.actions.delete')}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SecurityPanel({
  totpEnabled,
  passkeyCount,
  setup,
  totpSetupLoading,
  totpBinding,
  totpDeleting,
  passwordChanging,
  passkeys,
  passkeyCreating,
  passkeyDeleting,
  emailStatus,
  emailCapability,
  emailCapabilityLoading,
  emailCapabilityError,
  emailUpdating,
  emailVerificationRequesting,
  onShowTotp,
  onBindTotp,
  onDeleteTotp,
  onChangePassword,
  onCreatePasskey,
  onDeletePasskey,
  onRefreshEmailCapability,
  onUpdateEmail,
  onRequestEmailVerification,
}: {
  totpEnabled: boolean
  passkeyCount: number
  setup: ReturnType<typeof useUserWorkspace>['totpSetup']
  totpSetupLoading: boolean
  totpBinding: boolean
  totpDeleting: boolean
  passwordChanging: boolean
  passkeys: UserPasskeyResource[]
  passkeyCreating: boolean
  passkeyDeleting: boolean
  emailStatus: UserEmailStatus
  emailCapability: ReturnType<typeof useUserWorkspace>['userCapabilities']
  emailCapabilityLoading: boolean
  emailCapabilityError: string | null
  emailUpdating: boolean
  emailVerificationRequesting: boolean
  onShowTotp: (regenerate?: boolean) => Promise<void>
  onBindTotp: (input: { secret: string; code: string; issuer?: string }) => Promise<unknown>
  onDeleteTotp: () => Promise<unknown>
  onChangePassword: (input: { newPassword: string }) => Promise<unknown>
  onCreatePasskey: (input: { name?: string }) => Promise<unknown>
  onDeletePasskey: (passkey: UserPasskeyResource) => Promise<unknown>
  onRefreshEmailCapability: () => Promise<unknown>
  onUpdateEmail: (email: string) => Promise<unknown>
  onRequestEmailVerification: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [passkeyName, setPasskeyName] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [emailEditing, setEmailEditing] = useState(false)
  const [totpAction, setTotpAction] = useState<'show' | 'regenerate' | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const securityErrorRef = useRef<HTMLDivElement>(null)
  const [pendingSecurityDelete, setPendingSecurityDelete] = useState<SecurityDeleteTarget | null>(
    null,
  )
  const securityDeleting = totpDeleting || passkeyDeleting
  const emailMutating = emailUpdating || emailVerificationRequesting

  useEffect(() => {
    if (localError) securityErrorRef.current?.focus()
  }, [localError])

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!newPassword) {
      setLocalError(t('userWorkspace.security.validation.passwordRequired'))
      return
    }

    if (newPassword !== confirmPassword) {
      setLocalError(t('userWorkspace.security.validation.passwordMismatch'))
      return
    }

    try {
      setLocalError(null)
      await onChangePassword({ newPassword })
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('userWorkspace.toast.passwordUpdated'))
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleBindTotp = async () => {
    if (!setup?.secret) {
      setLocalError(t('userWorkspace.security.validation.totpSetupRequired'))
      return
    }

    if (!totpCode.trim()) {
      setLocalError(t('userWorkspace.security.validation.totpCodeRequired'))
      return
    }

    try {
      setLocalError(null)
      await onBindTotp({
        secret: setup.secret,
        code: totpCode,
        issuer: setup.issuer,
      })
      setTotpCode('')
      toast.success(t('userWorkspace.toast.totpEnabled'))
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleShowTotp = async (regenerate: boolean) => {
    setTotpAction(regenerate ? 'regenerate' : 'show')

    try {
      setLocalError(null)
      await onShowTotp(regenerate)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    } finally {
      setTotpAction(null)
    }
  }

  const handleCreatePasskey = async () => {
    try {
      setLocalError(null)
      await onCreatePasskey({ name: passkeyName })
      setPasskeyName('')
      toast.success(t('userWorkspace.toast.passkeyCreated'))
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = emailDraft.trim()
    if (!email) {
      setLocalError(t('userWorkspace.security.validation.emailRequired'))
      return
    }

    try {
      setLocalError(null)
      await onUpdateEmail(email)
      setEmailDraft('')
      setEmailEditing(false)
      try {
        await onRequestEmailVerification()
        toast.success(t('userWorkspace.toast.emailUpdatedAndSent'))
      } catch (requestError) {
        toast.success(t('userWorkspace.toast.emailUpdated'))
        setLocalError(userSecurityErrorMessage(t, requestError))
      }
    } catch (requestError) {
      setLocalError(userSecurityErrorMessage(t, requestError))
    }
  }

  const handleEmailVerification = async () => {
    try {
      setLocalError(null)
      await onRequestEmailVerification()
      toast.success(t('userWorkspace.toast.emailVerificationSent'))
    } catch (requestError) {
      setLocalError(userSecurityErrorMessage(t, requestError))
    }
  }

  const handleSecurityDelete = async () => {
    if (!pendingSecurityDelete) return

    try {
      setLocalError(null)
      if (pendingSecurityDelete.type === 'totp') {
        await onDeleteTotp()
        toast.success(t('userWorkspace.toast.totpDeleted'))
      } else {
        await onDeletePasskey(pendingSecurityDelete.passkey)
        toast.success(t('userWorkspace.toast.passkeyDeleted'))
      }
      setPendingSecurityDelete(null)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
      <div className="flex items-start gap-3 border-b p-4">
        <span className="bg-success/10 text-success flex size-9 shrink-0 items-center justify-center rounded-md">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t('userWorkspace.security.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {t('userWorkspace.security.description')}
          </p>
        </div>
      </div>

      {localError ? (
        <div
          ref={securityErrorRef}
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          className="border-destructive/30 bg-destructive/10 text-destructive mx-4 mt-4 rounded-md border px-3 py-2 text-sm outline-none"
        >
          {localError}
        </div>
      ) : null}

      <div className="grid gap-0 md:grid-cols-2">
        <form
          className="grid gap-4 p-4 md:border-r"
          onSubmit={(event) => void handlePasswordSubmit(event)}
        >
          <div>
            <h3 className="text-sm font-semibold">{t('userWorkspace.security.password.title')}</h3>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('userWorkspace.security.password.description')}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('userWorkspace.security.password.newPassword')}</span>
            <Input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              disabled={passwordChanging}
              placeholder={t('userWorkspace.security.password.newPasswordPlaceholder')}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('userWorkspace.security.password.confirmPassword')}</span>
            <Input
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              disabled={passwordChanging}
              placeholder={t('userWorkspace.security.password.confirmPasswordPlaceholder')}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={passwordChanging} className="w-fit">
            {passwordChanging ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t('userWorkspace.security.password.action')}
          </Button>
        </form>

        <div className="grid content-start gap-4 border-t p-4 md:border-t-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">{t('userWorkspace.security.totp.title')}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {t('userWorkspace.security.totp.description')}
              </p>
            </div>
            <span className="border-info/25 bg-info/10 text-info w-fit rounded-md border px-2 py-1 text-xs font-medium">
              {totpEnabled
                ? t('userWorkspace.security.totp.enabled')
                : t('userWorkspace.security.totp.disabled')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={totpSetupLoading || totpBinding || totpDeleting}
              onClick={() => void handleShowTotp(false)}
            >
              {totpSetupLoading && totpAction === 'show' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('userWorkspace.security.totp.showSetup')}
            </Button>
            <Button
              variant="outline"
              disabled={totpSetupLoading || totpBinding || totpDeleting}
              onClick={() => void handleShowTotp(true)}
            >
              {totpSetupLoading && totpAction === 'regenerate' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('userWorkspace.security.totp.regenerate')}
            </Button>
            {totpEnabled ? (
              <Button
                variant="destructive"
                disabled={totpSetupLoading || totpBinding || totpDeleting}
                onClick={() => setPendingSecurityDelete({ type: 'totp' })}
              >
                {totpDeleting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
                {t('userWorkspace.security.totp.delete')}
              </Button>
            ) : null}
          </div>
          {setup ? (
            <div className="grid gap-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                {setup.otpAuthUrl ? (
                  <div className="bg-background flex size-36 shrink-0 items-center justify-center rounded-md border p-2">
                    <QRCodeSVG value={setup.otpAuthUrl} size={128} />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-xs">
                    {t('userWorkspace.security.totp.secret')}
                  </p>
                  <p className="mt-1 font-mono text-sm break-all">{setup.secret}</p>
                </div>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                <span>{t('userWorkspace.security.totp.code')}</span>
                <Input
                  value={totpCode}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={totpBinding || totpDeleting}
                  placeholder={t('userWorkspace.security.totp.codePlaceholder')}
                  onChange={(event) => setTotpCode(event.target.value)}
                />
              </label>
              <Button
                type="button"
                disabled={totpBinding || totpDeleting}
                className="w-fit"
                onClick={() => void handleBindTotp()}
              >
                {totpBinding ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t('userWorkspace.security.totp.bind')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 border-t p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="bg-info/10 text-info flex size-9 shrink-0 items-center justify-center rounded-md">
              <Mail className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">{t('userWorkspace.security.email.title')}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {t('userWorkspace.security.email.description')}
              </p>
            </div>
          </div>
          {!emailCapabilityLoading && !emailCapabilityError ? (
            <span
              className={
                emailStatus.verified
                  ? 'border-success/30 bg-success/10 text-success-foreground w-fit rounded-md border px-2 py-1 text-xs font-medium'
                  : emailStatus.configured
                    ? 'border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning w-fit rounded-md border px-2 py-1 text-xs font-medium'
                    : 'border-info/25 bg-info/10 text-info w-fit rounded-md border px-2 py-1 text-xs font-medium'
              }
            >
              {emailStatus.verified
                ? t('userWorkspace.security.email.verified')
                : emailStatus.configured
                  ? t('userWorkspace.security.email.unverified')
                  : t('userWorkspace.security.email.notConfigured')}
            </span>
          ) : null}
        </div>

        {emailCapabilityLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('userWorkspace.security.email.loadingCapability')}
          </div>
        ) : emailCapabilityError ? (
          <div className="grid gap-3">
            <div className="border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t('userWorkspace.security.email.capabilityError')}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => void onRefreshEmailCapability()}
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
              {t('userRecovery.actions.retry')}
            </Button>
          </div>
        ) : !emailCapability?.emailVerification ? (
          <div className="border-border bg-muted/40 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
            <CircleAlert
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p>
                {emailCapability?.endpointSupported
                  ? t('userWorkspace.security.email.disabled')
                  : t('userWorkspace.security.email.legacy')}
              </p>
              {emailStatus.configured && emailStatus.masked ? (
                <p className="text-muted-foreground mt-1">
                  {t('userWorkspace.security.email.current', {
                    email: emailStatus.masked,
                  })}
                </p>
              ) : null}
            </div>
          </div>
        ) : emailEditing ? (
          <form
            className="grid gap-3 md:max-w-2xl md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => void handleEmailSubmit(event)}
          >
            <label className="grid gap-2 text-sm font-medium md:col-span-2">
              <span>
                {emailStatus.configured
                  ? t('userWorkspace.security.email.changeLabel')
                  : t('userWorkspace.security.email.addLabel')}
              </span>
              <Input
                type="email"
                value={emailDraft}
                autoComplete="email"
                disabled={emailMutating}
                placeholder={t('userWorkspace.security.email.placeholder')}
                onChange={(event) => setEmailDraft(event.target.value)}
              />
              <span className="text-muted-foreground text-xs leading-5">
                {t('userWorkspace.security.email.saveHint')}
              </span>
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" disabled={emailMutating}>
                {emailMutating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t('userWorkspace.security.email.save')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={emailMutating}
                onClick={() => {
                  setEmailDraft('')
                  setEmailEditing(false)
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {emailStatus.configured && emailStatus.masked ? (
                <p className="font-medium break-all">{emailStatus.masked}</p>
              ) : null}
              <p className="text-muted-foreground text-sm leading-6">
                {emailStatus.verified
                  ? t('userWorkspace.security.email.verifiedDescription')
                  : emailStatus.configured
                    ? t('userWorkspace.security.email.unverifiedDescription')
                    : t('userWorkspace.security.email.emptyDescription')}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {emailStatus.configured && !emailStatus.verified ? (
                <Button
                  type="button"
                  disabled={emailMutating}
                  onClick={() => void handleEmailVerification()}
                >
                  {emailVerificationRequesting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="size-4" aria-hidden="true" />
                  )}
                  {t('userWorkspace.security.email.resend')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant={emailStatus.configured ? 'outline' : 'default'}
                disabled={emailMutating}
                onClick={() => setEmailEditing(true)}
              >
                {emailStatus.verified ? <BadgeCheck className="size-4" aria-hidden="true" /> : null}
                {emailStatus.configured
                  ? t('userWorkspace.security.email.change')
                  : t('userWorkspace.security.email.add')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 border-t p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold">{t('userWorkspace.security.passkey.title')}</h3>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('userWorkspace.security.passkey.description')}
            </p>
          </div>
          <span className="border-info/25 bg-info/10 text-info w-fit rounded-md border px-2 py-1 text-xs font-medium">
            {t('userWorkspace.security.passkey.count', { count: passkeyCount })}
          </span>
        </div>
        {passkeys.length > 0 ? (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('userWorkspace.security.passkey.table.name')}</TableHead>
                  <TableHead>{t('userWorkspace.security.passkey.table.createdAt')}</TableHead>
                  <TableHead>{t('userWorkspace.security.passkey.table.updatedAt')}</TableHead>
                  <TableHead className="w-24 text-right">
                    {t('userWorkspace.security.passkey.table.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passkeys.map((passkey) => (
                  <TableRow key={passkey.id}>
                    <TableCell className="min-w-0">
                      <div className="font-medium break-all">
                        {passkey.name || t('userWorkspace.security.passkey.unnamed')}
                      </div>
                      <div className="text-muted-foreground mt-1 font-mono text-xs break-all">
                        {passkey.id}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatOptionalTime(
                        passkey.createdAt,
                        t('userWorkspace.summary.notAvailable'),
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatOptionalTime(
                        passkey.updatedAt,
                        t('userWorkspace.summary.notAvailable'),
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={passkeyDeleting}
                        aria-label={t('userWorkspace.security.passkey.delete')}
                        onClick={() => setPendingSecurityDelete({ type: 'passkey', passkey })}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs leading-5">
            {t('userWorkspace.security.passkey.empty')}
          </p>
        )}
        <div className="grid gap-3 md:max-w-xl md:grid-cols-[1fr_auto]">
          <Input
            value={passkeyName}
            disabled={passkeyCreating || passkeyDeleting}
            placeholder={t('userWorkspace.security.passkey.namePlaceholder')}
            onChange={(event) => setPasskeyName(event.target.value)}
          />
          <Button
            type="button"
            disabled={passkeyCreating || passkeyDeleting}
            onClick={() => void handleCreatePasskey()}
          >
            {passkeyCreating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t('userWorkspace.security.passkey.create')}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={Boolean(pendingSecurityDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingSecurityDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('userWorkspace.security.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSecurityDelete?.type === 'totp'
                ? t('userWorkspace.security.delete.totp')
                : pendingSecurityDelete?.type === 'passkey'
                  ? t('userWorkspace.security.delete.passkey', {
                      name: pendingSecurityDelete.passkey.name || pendingSecurityDelete.passkey.id,
                    })
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={securityDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
              disabled={securityDeleting}
              onClick={(event) => {
                event.preventDefault()
                void handleSecurityDelete()
              }}
            >
              {securityDeleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('userWorkspace.security.delete.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function UserWorkspacePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const status = useUserSessionStore((state) => state.status)
  const expiresAt = useUserSessionStore((state) => state.expiresAt)
  const logout = useUserSessionStore((state) => state.logout)
  const workbench = useUserWorkspace()
  const user = workbench.user
  const authenticated = status === 'authenticated' && user
  const [sheetMode, setSheetMode] = useState<KeySheetMode | null>(null)
  const [pendingDelete, setPendingDelete] = useState<UserApiKeyResource | null>(null)

  const handleLogout = async () => {
    logout()
    await navigate({ to: '/user/login' })
  }

  const handleCopy = async (resource: UserApiKeyResource) => {
    await copyText(resource.key)
    toast.success(t('userWorkspace.toast.copied'))
  }

  const closeSheet = () => setSheetMode(null)

  return (
    <PublicAccessShell>
      <section className="mx-auto grid max-w-5xl gap-6">
        <Button asChild variant="text" size="sm" className="w-fit px-0">
          <a href={embeddedEntryLinks.bridge}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('userWorkspace.back')}
          </a>
        </Button>

        {!authenticated ? (
          <div className="bg-card rounded-lg border p-5 shadow-sm md:p-6">
            <span className="bg-info/10 text-info flex size-11 items-center justify-center rounded-md">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">{t('userWorkspace.signedOut.title')}</h1>
            <p className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-6">
              {t('userWorkspace.signedOut.description')}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/user/login">{t('userWorkspace.login')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/user/register">{t('userWorkspace.register')}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="bg-card rounded-lg border p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <span className="bg-info/10 text-info flex size-11 items-center justify-center rounded-md">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                  <h1 className="mt-5 text-xl font-semibold">{t('userWorkspace.title')}</h1>
                  <p className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-6">
                    {t('userWorkspace.description')}
                  </p>
                </div>
                <Button variant="outline" onClick={() => void handleLogout()}>
                  <LogOut className="size-4" aria-hidden="true" />
                  {t('userWorkspace.logout')}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="bg-card rounded-lg border p-4">
                <p className="text-muted-foreground text-xs">{t('userWorkspace.summary.user')}</p>
                <p className="mt-2 truncate text-sm font-semibold">{user.username}</p>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <p className="text-muted-foreground text-xs">
                  {t('userWorkspace.summary.credits')}
                </p>
                <p className="mt-2 text-sm font-semibold">{formatCreditAmount(user.credits)}</p>
              </div>
              <div className="bg-card rounded-lg border p-4">
                <p className="text-muted-foreground text-xs">
                  {t('userWorkspace.summary.expiresAt')}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {formatOptionalTime(expiresAt, t('userWorkspace.summary.notAvailable'))}
                </p>
              </div>
            </div>

            <UserBillingReport />

            <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
              <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
                    <KeyRound className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">{t('userWorkspace.keys.title')}</h2>
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                      {t('userWorkspace.keys.description')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void workbench.refreshApiKeys()}
                    disabled={workbench.apiKeysFetching}
                  >
                    <RefreshCcw
                      className={workbench.apiKeysFetching ? 'size-4 animate-spin' : 'size-4'}
                      aria-hidden="true"
                    />
                    {t('userWorkspace.keys.actions.refresh')}
                  </Button>
                  <Button onClick={() => setSheetMode({ type: 'create' })}>
                    <Plus className="size-4" aria-hidden="true" />
                    {t('userWorkspace.keys.actions.new')}
                  </Button>
                </div>
              </div>
              {workbench.apiKeysError ? (
                <div className="border-destructive/30 bg-destructive/10 text-destructive m-4 rounded-md border px-3 py-2 text-sm">
                  {workbench.apiKeysError}
                </div>
              ) : null}
              <ApiKeysTable
                keys={workbench.apiKeys}
                loading={workbench.apiKeysLoading}
                onCopy={(resource) => void handleCopy(resource)}
                onEdit={(resource) => setSheetMode({ type: 'edit', resource })}
                onDelete={setPendingDelete}
              />
            </div>

            <SecurityPanel
              totpEnabled={user.totpEnabled}
              passkeyCount={user.passkeyCount}
              setup={workbench.totpSetup}
              totpSetupLoading={workbench.totpSetupLoading}
              totpBinding={workbench.totpBinding}
              totpDeleting={workbench.totpDeleting}
              passwordChanging={workbench.passwordChanging}
              passkeys={workbench.passkeys}
              passkeyCreating={workbench.passkeyCreating}
              passkeyDeleting={workbench.passkeyDeleting}
              emailStatus={user.emailStatus}
              emailCapability={workbench.userCapabilities}
              emailCapabilityLoading={workbench.userCapabilitiesLoading}
              emailCapabilityError={workbench.userCapabilitiesError}
              emailUpdating={workbench.emailUpdating}
              emailVerificationRequesting={workbench.emailVerificationRequesting}
              onShowTotp={async (regenerate) => {
                await workbench.showTotpSetup({ regenerate })
              }}
              onBindTotp={workbench.bindTotp}
              onDeleteTotp={workbench.deleteTotp}
              onChangePassword={workbench.changePassword}
              onCreatePasskey={workbench.createPasskey}
              onDeletePasskey={workbench.deletePasskey}
              onRefreshEmailCapability={async () => {
                await workbench.refreshUserCapabilities()
              }}
              onUpdateEmail={workbench.updateEmail}
              onRequestEmailVerification={workbench.requestEmailVerification}
            />
          </div>
        )}

        <Sheet open={Boolean(sheetMode)} onOpenChange={(open) => !open && closeSheet()}>
          <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
            {sheetMode ? (
              <>
                <SheetHeader className="border-b p-5">
                  <SheetTitle>
                    {sheetMode.type === 'create'
                      ? t('userWorkspace.keys.sheet.createTitle')
                      : t('userWorkspace.keys.sheet.editTitle')}
                  </SheetTitle>
                  <SheetDescription>
                    {sheetMode.type === 'create'
                      ? t('userWorkspace.keys.sheet.createDescription')
                      : t('userWorkspace.keys.sheet.editDescription')}
                  </SheetDescription>
                </SheetHeader>
                <ApiKeyForm
                  mode={sheetMode}
                  mutating={workbench.apiKeysMutating}
                  onCancel={closeSheet}
                  onSubmit={async (input) => {
                    if (sheetMode.type === 'create') {
                      await workbench.createApiKey(input)
                      toast.success(t('userWorkspace.toast.keyCreated'))
                    } else {
                      await workbench.updateApiKey({ resource: sheetMode.resource, input })
                      toast.success(t('userWorkspace.toast.keyUpdated'))
                    }
                    closeSheet()
                  }}
                />
              </>
            ) : null}
          </SheetContent>
        </Sheet>

        <AlertDialog
          open={Boolean(pendingDelete)}
          onOpenChange={(open) => !open && setPendingDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('userWorkspace.keys.deleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('userWorkspace.keys.deleteDescription', {
                  key: pendingDelete?.maskedKey ?? '',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={workbench.apiKeysMutating}>
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 text-white"
                disabled={workbench.apiKeysMutating}
                onClick={(event) => {
                  event.preventDefault()
                  if (!pendingDelete) return

                  void workbench.deleteApiKey(pendingDelete).then(() => {
                    toast.success(t('userWorkspace.toast.keyDeleted'))
                    setPendingDelete(null)
                  })
                }}
              >
                {workbench.apiKeysMutating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t('userWorkspace.keys.actions.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </PublicAccessShell>
  )
}
