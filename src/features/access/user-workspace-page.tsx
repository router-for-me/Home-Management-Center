import { type FormEvent, useEffect, useState } from 'react'

import { Link, useNavigate } from '@tanstack/react-router'

import {
  ArrowLeft,
  Copy,
  Edit3,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PublicAccessShell } from '@/components/public/public-access-shell'
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
import { useUserSessionStore } from '@/stores/user-session-store'

import { useUserWorkspace } from './use-user-workspace'

type KeySheetMode = { type: 'create' } | { type: 'edit'; resource: UserApiKeyResource }

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
      <div className="text-muted-foreground px-4 py-10 text-center text-sm">
        {t('userWorkspace.keys.empty')}
      </div>
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
                  {t('common.delete')}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
    await navigate({ to: '/' })
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
          <Link to="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('userWorkspace.back')}
          </Link>
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
                <Link to="/login">{t('userWorkspace.login')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/register">{t('userWorkspace.register')}</Link>
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
                <p className="mt-2 text-sm font-semibold">
                  {new Intl.NumberFormat().format(user.credits)}
                </p>
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
                    {t('common.refresh')}
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

            <div className="bg-card rounded-lg border p-5">
              <div className="flex items-start gap-3">
                <span className="bg-success/10 text-success flex size-9 shrink-0 items-center justify-center rounded-md">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{t('userWorkspace.security.title')}</h2>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    {t('userWorkspace.security.pending')}
                  </p>
                </div>
              </div>
            </div>
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
                  mutating={workbench.mutating}
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
              <AlertDialogCancel disabled={workbench.mutating}>
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 text-white"
                disabled={workbench.mutating}
                onClick={(event) => {
                  event.preventDefault()
                  if (!pendingDelete) return

                  void workbench.deleteApiKey(pendingDelete).then(() => {
                    toast.success(t('userWorkspace.toast.keyDeleted'))
                    setPendingDelete(null)
                  })
                }}
              >
                {workbench.mutating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </PublicAccessShell>
  )
}
