import { type FormEvent, useEffect, useState } from 'react'

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { useUserWorkbench } from '@/features/users/use-user-workbench'
import type { UserFormInput, UserResource, UserRole } from '@/lib/api/management/users'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type DetailMode = 'detail' | 'edit' | 'create'
type PendingUserAction = { type: 'disable' | 'enable'; user: UserResource }

function formatDateTime(value: string | null) {
  if (!value) return null

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrency(value: number | null) {
  if (value === null) return null

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  }).format(value)
}

function formatPercent(value: number | null) {
  if (value === null) return null

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value)}%`
}

function UsersDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <UsersRound className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('usersPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('usersPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <UsersRound className="size-4" aria-hidden="true" />
            {t('usersPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function UsersLoadingState() {
  return (
    <section className="grid gap-5">
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg" />
    </section>
  )
}

function UsersErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-md border">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('usersPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('usersPage.error.description')}
              </p>
            </div>
          </div>
          <Button variant="outline" className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('usersPage.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function UsersUnsupportedState({ runtimeLabel }: { runtimeLabel: string }) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex min-w-0 gap-4">
          <div className="border-info/30 bg-info/10 text-info flex size-11 shrink-0 items-center justify-center rounded-md border">
            <UsersRound className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal">
              {t('usersPage.unsupported.title')}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
              {t('usersPage.unsupported.description', { mode: runtimeLabel })}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function UserStatusBadge({ user }: { user: UserResource }) {
  const { t } = useTranslation()
  const quotaPaused = Boolean(user.quota?.paused)
  const disabled = user.disabled || quotaPaused

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        disabled
          ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
          : 'border-success/30 bg-success/10 text-success',
      )}
    >
      {disabled ? (
        <AlertTriangle className="size-3" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-3" aria-hidden="true" />
      )}
      {quotaPaused
        ? t('usersPage.status.quotaPaused')
        : user.disabled
          ? t('usersPage.status.disabled')
          : t('usersPage.status.active')}
    </span>
  )
}

function UserRoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation()
  const admin = role === 'admin'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        admin ? 'border-primary/30 bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
      )}
    >
      {admin ? (
        <ShieldCheck className="size-3" aria-hidden="true" />
      ) : (
        <UserRound className="size-3" aria-hidden="true" />
      )}
      {t(`usersPage.roles.${role}`)}
    </span>
  )
}

function UsersTable({
  resources,
  selectedUserId,
  mutating,
  onView,
  onEdit,
  onToggleStatus,
}: {
  resources: UserResource[]
  selectedUserId: string | null
  mutating: boolean
  onView: (user: UserResource) => void
  onEdit: (user: UserResource) => void
  onToggleStatus: (user: UserResource) => void
}) {
  const { t } = useTranslation()

  if (resources.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border px-4 py-10 text-center text-sm">
        {t('usersPage.list.empty')}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader className="bg-muted/70 text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('usersPage.list.user')}</TableHead>
              <TableHead>{t('usersPage.list.role')}</TableHead>
              <TableHead>{t('usersPage.list.status')}</TableHead>
              <TableHead>{t('usersPage.list.keys')}</TableHead>
              <TableHead>{t('usersPage.list.usage')}</TableHead>
              <TableHead>{t('usersPage.list.quota')}</TableHead>
              <TableHead className="w-[240px] text-right">{t('usersPage.list.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((user) => (
              <TableRow
                key={user.id}
                className={cn(
                  'hover:bg-accent/40 transition-colors',
                  selectedUserId === user.id ? 'bg-primary/8' : null,
                )}
              >
                <TableCell>
                  <div className="min-w-0">
                    <p className="font-medium">{user.label}</p>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">{user.username}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <UserRoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <UserStatusBadge user={user} />
                </TableCell>
                <TableCell>{formatNumber(user.keyCount)}</TableCell>
                <TableCell>
                  <p className="font-medium">{formatNumber(user.usage.todayRecords)}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t('usersPage.list.usageMeta', {
                      tokens: formatNumber(user.usage.todayTotalTokens),
                      cost: formatCurrency(user.usage.todayEstimatedCostUsd),
                    })}
                  </p>
                </TableCell>
                <TableCell>
                  {user.quota ? (
                    <div className="min-w-0">
                      <p className="font-medium">
                        {user.quota.unlimited
                          ? t('usersPage.quota.unlimited')
                          : (formatCurrency(user.quota.monthlyRemainingUsd) ??
                            t('usersPage.status.notAvailable'))}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {user.quota.quotaMonth ?? t('usersPage.status.notAvailable')}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {t('usersPage.status.notAvailable')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      className="px-2"
                      onClick={() => onView(user)}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                      {t('usersPage.actions.view')}
                    </Button>
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      className="px-2"
                      onClick={() => onEdit(user)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      {t('usersPage.actions.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant={user.disabled ? 'text' : 'destructiveText'}
                      size="sm"
                      className="px-2"
                      disabled={mutating}
                      onClick={() => onToggleStatus(user)}
                    >
                      {user.disabled ? (
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                      ) : (
                        <Ban className="size-4" aria-hidden="true" />
                      )}
                      {user.disabled
                        ? t('usersPage.actions.enable')
                        : t('usersPage.actions.disable')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function UserForm({
  mode,
  user,
  mutating,
  onCancel,
  onCreate,
  onUpdate,
}: {
  mode: Extract<DetailMode, 'create' | 'edit'>
  user: UserResource | null
  mutating: boolean
  onCancel: () => void
  onCreate: (input: UserFormInput) => Promise<void>
  onUpdate: (input: UserFormInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setLocalError(null)
    setUsername(mode === 'edit' && user ? user.username : '')
    setNickname(mode === 'edit' && user ? (user.nickname ?? '') : '')
    setRole(mode === 'edit' && user?.role === 'admin' ? 'admin' : 'user')
    setPassword('')
  }, [mode, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedUsername = username.trim()

    if (!trimmedUsername) {
      setLocalError(t('usersPage.form.validation.usernameRequired'))
      return
    }

    try {
      setLocalError(null)
      const input: UserFormInput = {
        username: trimmedUsername,
        nickname,
        role,
        password: mode === 'create' ? password : undefined,
      }

      if (mode === 'create') {
        await onCreate(input)
      } else {
        await onUpdate(input)
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="p-5">
      <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('usersPage.form.username')}</span>
          <Input
            value={username}
            disabled={mutating}
            placeholder={t('usersPage.form.usernamePlaceholder')}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('usersPage.form.nickname')}</span>
          <Input
            value={nickname}
            disabled={mutating}
            placeholder={t('usersPage.form.nicknamePlaceholder')}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          <span>{t('usersPage.form.role')}</span>
          <Select
            value={role}
            disabled={mutating}
            onValueChange={(value) => setRole(value === 'admin' ? 'admin' : 'user')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">{t('usersPage.roles.user')}</SelectItem>
              <SelectItem value="admin">{t('usersPage.roles.admin')}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        {mode === 'create' ? (
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('usersPage.form.password')}</span>
            <Input
              type="password"
              value={password}
              disabled={mutating}
              placeholder={t('usersPage.form.passwordPlaceholder')}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        ) : null}
        {localError ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {localError}
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutating}>
            {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {mode === 'create' ? t('usersPage.actions.create') : t('usersPage.actions.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}

function UserDetailContent({ user, loading }: { user: UserResource | null; loading: boolean }) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="grid gap-4 p-5">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-5 text-sm">
        <div className="bg-muted/60 text-muted-foreground flex min-h-48 items-center justify-center rounded-md border px-4 text-center">
          {t('usersPage.detail.empty')}
        </div>
      </div>
    )
  }

  const details = [
    ['id', user.id],
    ['username', user.username],
    ['nickname', user.nickname ?? t('usersPage.status.notAvailable')],
    ['createdAt', formatDateTime(user.createdAt) ?? t('usersPage.status.notAvailable')],
    ['updatedAt', formatDateTime(user.updatedAt) ?? t('usersPage.status.notAvailable')],
    ['disabledAt', formatDateTime(user.disabledAt) ?? t('usersPage.status.notAvailable')],
  ] as const

  return (
    <div className="grid gap-5 p-5">
      <div className="rounded-md border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <UserRoleBadge role={user.role} />
          <UserStatusBadge user={user} />
        </div>
        <p className="mt-3 text-base font-semibold">{user.label}</p>
        <p className="text-muted-foreground mt-1 font-mono text-xs">{user.username}</p>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">{t('usersPage.detail.sections.profile')}</h3>
        <dl className="grid gap-2 text-sm">
          {details.map(([key, value]) => (
            <div key={key} className="rounded-md border px-3 py-2.5">
              <dt className="text-muted-foreground text-xs">
                {t(`usersPage.detail.fields.${key}`)}
              </dt>
              <dd className="mt-1 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">{t('usersPage.detail.sections.usage')}</h3>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs">{t('usersPage.detail.fields.requests')}</p>
            <p className="mt-1 font-medium">{formatNumber(user.usage.todayRecords)}</p>
          </div>
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs">{t('usersPage.detail.fields.tokens')}</p>
            <p className="mt-1 font-medium">{formatNumber(user.usage.todayTotalTokens)}</p>
          </div>
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs">{t('usersPage.detail.fields.cost')}</p>
            <p className="mt-1 font-medium">{formatCurrency(user.usage.todayEstimatedCostUsd)}</p>
          </div>
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs">
              {t('usersPage.detail.fields.successRate')}
            </p>
            <p className="mt-1 font-medium">
              {formatPercent(user.usage.successRate) ?? t('usersPage.status.notAvailable')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">{t('usersPage.detail.sections.quota')}</h3>
        {user.quota ? (
          <div className="grid gap-2 text-sm">
            {[
              ['monthlyRemaining', formatCurrency(user.quota.monthlyRemainingUsd)],
              ['monthlyUsed', formatCurrency(user.quota.monthlyUsedUsd)],
              ['lifetimeRemaining', formatCurrency(user.quota.lifetimeRemainingUsd)],
              ['quotaMonth', user.quota.quotaMonth],
              ['pauseReason', user.quota.pauseReason],
              ['unpricedRecords', formatNumber(user.quota.unpricedRecords)],
            ].map(([key, value]) => (
              <div key={key} className="rounded-md border px-3 py-2.5">
                <p className="text-muted-foreground text-xs">
                  {t(`usersPage.detail.fields.${key}`)}
                </p>
                <p className="mt-1 break-words">{value ?? t('usersPage.status.notAvailable')}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-md border px-3 py-8 text-center text-sm">
            {t('usersPage.detail.quotaUnavailable')}
          </div>
        )}
      </div>
    </div>
  )
}

export function UsersWorkbenchPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailMode, setDetailMode] = useState<DetailMode>('detail')
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(null)
  const workbench = useUserWorkbench(selectedUserId)

  if (!workbench.connected) return <UsersDisconnectedState />
  if (!workbench.capabilityReady) return <UsersLoadingState />
  if (!workbench.capabilities.users) {
    return <UsersUnsupportedState runtimeLabel={t(`runtimeMode.${workbench.runtimeMode}`)} />
  }
  if (workbench.isPending) return <UsersLoadingState />
  if (workbench.isError) {
    return <UsersErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
  }

  const resources = workbench.snapshot?.resources ?? []
  const selectedUser =
    workbench.selectedUser ?? resources.find((user) => user.id === selectedUserId) ?? null
  const filteredResources = resources.filter((user) => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return true

    return [user.id, user.username, user.nickname ?? '', user.role]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  })
  const adminCount = resources.filter((user) => user.role === 'admin').length
  const disabledCount = resources.filter((user) => user.disabled).length
  const quotaPausedCount = resources.filter((user) => user.quota?.paused).length

  const closeSheet = () => {
    setDetailSheetOpen(false)
    setDetailMode('detail')
  }

  const handleCreate = async (input: UserFormInput) => {
    await workbench.createUser(input)
    toast.success(t('usersPage.toast.created'))
    closeSheet()
  }

  const handleUpdate = async (input: UserFormInput) => {
    if (!selectedUser) return

    await workbench.updateUser({ user: selectedUser, input })
    toast.success(t('usersPage.toast.updated'))
    setDetailMode('detail')
  }

  const handleConfirmStatusChange = async () => {
    if (!pendingAction) return

    if (pendingAction.type === 'disable') {
      await workbench.disableUser(pendingAction.user)
      toast.success(t('usersPage.toast.disabled'))
    } else {
      await workbench.enableUser(pendingAction.user)
      toast.success(t('usersPage.toast.enabled'))
    }

    setPendingAction(null)
  }

  return (
    <section className="grid gap-5">
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground text-sm font-medium">
              {t('usersPage.header.eyebrow')}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-normal">
              {t('usersPage.header.title')}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-4xl text-sm leading-6">
              {t('usersPage.header.description')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={workbench.isFetching}
              onClick={workbench.refetch}
            >
              {workbench.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {workbench.isFetching
                ? t('usersPage.actions.syncing')
                : t('usersPage.actions.refresh')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedUserId(null)
                setDetailMode('create')
                setDetailSheetOpen(true)
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('usersPage.actions.new')}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
            {t('usersPage.header.total', { count: resources.length })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usersPage.header.admins', { count: adminCount })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usersPage.header.disabled', { count: disabledCount })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usersPage.header.quotaPaused', { count: quotaPausedCount })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usersPage.header.updatedAt', {
              time: formatDateTime(workbench.snapshot?.fetchedAt ?? null),
            })}
          </span>
        </div>
      </div>

      <div className="bg-card min-w-0 rounded-lg border p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t('usersPage.list.title')}</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('usersPage.list.description')}
            </p>
          </div>
          <div className="relative min-w-0 md:w-80">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('usersPage.list.filterPlaceholder')}
            />
          </div>
        </div>
        <div className="mt-4">
          <UsersTable
            resources={filteredResources}
            selectedUserId={selectedUserId}
            mutating={workbench.mutating}
            onView={(user) => {
              setSelectedUserId(user.id)
              setDetailMode('detail')
              setDetailSheetOpen(true)
            }}
            onEdit={(user) => {
              setSelectedUserId(user.id)
              setDetailMode('edit')
              setDetailSheetOpen(true)
            }}
            onToggleStatus={(user) =>
              setPendingAction({ type: user.disabled ? 'enable' : 'disable', user })
            }
          />
        </div>
      </div>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-5">
            <SheetTitle>
              {detailMode === 'create'
                ? t('usersPage.form.createTitle')
                : detailMode === 'edit'
                  ? t('usersPage.form.editTitle')
                  : t('usersPage.detail.title')}
            </SheetTitle>
            <SheetDescription>
              {detailMode === 'create'
                ? t('usersPage.form.createDescription')
                : (selectedUser?.label ?? t('usersPage.detail.empty'))}
            </SheetDescription>
          </SheetHeader>
          {detailMode === 'create' || detailMode === 'edit' ? (
            <UserForm
              mode={detailMode}
              user={selectedUser}
              mutating={workbench.mutating}
              onCancel={closeSheet}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
            />
          ) : (
            <UserDetailContent user={selectedUser} loading={workbench.isFetchingSelectedUser} />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'disable'
                ? t('usersPage.statusDialog.disableTitle')
                : t('usersPage.statusDialog.enableTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction
                ? t(`usersPage.statusDialog.${pendingAction.type}Description`, {
                    name: pendingAction.user.label,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                pendingAction?.type === 'disable'
                  ? 'bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white'
                  : null,
              )}
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmStatusChange()
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {pendingAction?.type === 'disable'
                ? t('usersPage.actions.disable')
                : t('usersPage.actions.enable')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
