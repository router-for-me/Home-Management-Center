import { type FormEvent, useEffect, useMemo, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  KeyRound,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
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
import { Checkbox } from '@/components/ui/checkbox'
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
import type {
  AccessGroupDetailResource,
  AccessGroupKind,
  AccessGroupResource,
} from '@/lib/api/management/access-groups'
import type { AccessKeyResource } from '@/lib/api/management/access-keys'
import type { UserFormInput, UserResource } from '@/lib/api/management/users'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type UsersAccessTab = 'users' | 'keys' | 'channelGroups' | 'modelGroups'
type SheetMode =
  | { type: 'user-create' }
  | { type: 'user-edit'; user: UserResource }
  | { type: 'user-detail'; user: UserResource }
  | { type: 'key-create' }
  | { type: 'key-edit'; key: AccessKeyResource }
  | { type: 'group-create'; kind: AccessGroupKind }
  | { type: 'group-edit'; group: AccessGroupResource }
  | { type: 'detail-create'; kind: AccessGroupKind; groupId?: number }
type PendingDelete =
  | { type: 'user'; user: UserResource }
  | { type: 'key'; key: AccessKeyResource }
  | { type: 'group'; group: AccessGroupResource }
  | { type: 'detail'; detail: AccessGroupDetailResource }

const unassignedUserValue = '__unassigned__'

function formatDateTime(value: string | null) {
  if (!value) return null

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatOptionalTime(value: string | null, fallback: string) {
  return formatDateTime(value) ?? fallback
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function generateAccessKey() {
  const bytes = new Uint8Array(24)
  window.crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return `sk-${token}`
}

function groupLabel(groups: AccessGroupResource[], id: number) {
  return groups.find((group) => group.numericId === id)?.name ?? `#${id}`
}

function groupListLabel(groups: AccessGroupResource[], ids: number[], emptyLabel: string) {
  if (ids.length === 0) return emptyLabel
  return ids.map((id) => groupLabel(groups, id)).join(', ')
}

function userLabel(users: UserResource[], userId: number | null) {
  if (!userId) return null
  return users.find((user) => user.numericId === userId)?.username ?? `#${userId}`
}

function getUserKeys(keys: AccessKeyResource[], user: UserResource) {
  if (user.numericId === null) return []
  return keys.filter((key) => key.userId === user.numericId)
}

function getUnion(values: number[][]) {
  return [...new Set(values.flat())]
}

function createGroupSearchText(group: AccessGroupResource, details: AccessGroupDetailResource[]) {
  return [
    group.name,
    String(group.numericId),
    ...details
      .filter((detail) => detail.groupId === group.numericId)
      .map((detail) => detail.targetId),
  ]
    .join(' ')
    .toLowerCase()
}

function StatusBadge({ deletedAt }: { deletedAt: string | null }) {
  const { t } = useTranslation()
  const deleted = Boolean(deletedAt)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        deleted
          ? 'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning'
          : 'border-success/30 bg-success/10 text-success',
      )}
    >
      {deleted ? (
        <AlertTriangle className="size-3" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-3" aria-hidden="true" />
      )}
      {deleted ? t('usersPage.status.deleted') : t('usersPage.status.active')}
    </span>
  )
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

function AccessGroupsUnsupportedState() {
  const { t } = useTranslation()

  return (
    <div className="border-info/25 bg-info/10 text-foreground flex gap-3 rounded-lg border p-4">
      <div className="border-info/30 bg-info/10 text-info flex size-9 shrink-0 items-center justify-center rounded-md border">
        <ShieldCheck className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{t('usersPage.groups.unsupportedTitle')}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-6">
          {t('usersPage.groups.unsupportedDescription')}
        </p>
      </div>
    </div>
  )
}

function UserForm({
  mode,
  user,
  mutating,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  user: UserResource | null
  mutating: boolean
  onCancel: () => void
  onSubmit: (input: UserFormInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setLocalError(null)
    setUsername(mode === 'edit' && user ? user.username : '')
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
      await onSubmit({
        username: trimmedUsername,
        password: password.trim() || undefined,
      })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <form className="grid gap-4 p-5" onSubmit={(event) => void handleSubmit(event)}>
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('usersPage.form.username')}</span>
        <Input
          value={username}
          disabled={mutating || mode === 'edit'}
          placeholder={t('usersPage.form.usernamePlaceholder')}
          onChange={(event) => setUsername(event.target.value)}
        />
        {mode === 'edit' ? (
          <span className="text-muted-foreground text-xs leading-5">
            {t('usersPage.form.usernameLockedHint')}
          </span>
        ) : null}
      </label>
      <label className="grid gap-2 text-sm font-medium">
        <span>
          {mode === 'create' ? t('usersPage.form.password') : t('usersPage.form.passwordOptional')}
        </span>
        <Input
          type="password"
          value={password}
          disabled={mutating}
          placeholder={t('usersPage.form.passwordPlaceholder')}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
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
  )
}

function GroupCheckboxList({
  label,
  emptyLabel,
  groups,
  selected,
  onToggle,
}: {
  label: string
  emptyLabel: string
  groups: AccessGroupResource[]
  selected: number[]
  onToggle: (id: number) => void
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      {groups.length === 0 ? (
        <div className="text-muted-foreground rounded-md border px-3 py-3 text-sm">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md border p-2">
          {groups.map((group) => (
            <label
              key={group.id}
              className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <Checkbox
                checked={selected.includes(group.numericId)}
                onCheckedChange={() => onToggle(group.numericId)}
              />
              <span className="min-w-0 truncate">{group.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function AccessKeyForm({
  mode,
  accessKey,
  users,
  channelGroups,
  modelGroups,
  mutating,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  accessKey: AccessKeyResource | null
  users: UserResource[]
  channelGroups: AccessGroupResource[]
  modelGroups: AccessGroupResource[]
  mutating: boolean
  onCancel: () => void
  onSubmit: (input: {
    value: string
    userId: number | null
    channelGroupIds: number[]
    modelGroupIds: number[]
  }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [userId, setUserId] = useState<number | null>(null)
  const [channelGroupIds, setChannelGroupIds] = useState<number[]>([])
  const [modelGroupIds, setModelGroupIds] = useState<number[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setLocalError(null)
    setValue(mode === 'edit' && accessKey ? accessKey.value : generateAccessKey())
    setUserId(mode === 'edit' && accessKey ? accessKey.userId : null)
    setChannelGroupIds(mode === 'edit' && accessKey ? accessKey.channelGroupIds : [])
    setModelGroupIds(mode === 'edit' && accessKey ? accessKey.modelGroupIds : [])
  }, [mode, accessKey])

  const toggleChannelGroup = (id: number) => {
    setChannelGroupIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const toggleModelGroup = (id: number) => {
    setModelGroupIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedValue = value.trim()

    if (!trimmedValue) {
      setLocalError(t('usersPage.form.validation.keyRequired'))
      return
    }

    try {
      setLocalError(null)
      await onSubmit({
        value: trimmedValue,
        userId,
        channelGroupIds,
        modelGroupIds,
      })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <form className="grid gap-4 p-5" onSubmit={(event) => void handleSubmit(event)}>
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('usersPage.keys.keyValue')}</span>
        <Input
          value={value}
          disabled={mutating || mode === 'edit'}
          className="font-mono text-xs"
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('usersPage.keys.owner')}</span>
        <Select
          value={userId === null ? unassignedUserValue : String(userId)}
          disabled={mutating}
          onValueChange={(nextValue) =>
            setUserId(nextValue === unassignedUserValue ? null : Number(nextValue))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={unassignedUserValue}>{t('usersPage.keys.unassigned')}</SelectItem>
            {users
              .filter((user) => user.numericId !== null && !user.deletedAt)
              .map((user) => (
                <SelectItem key={user.id} value={String(user.numericId)}>
                  {user.username}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </label>
      <GroupCheckboxList
        label={t('usersPage.scopes.credential')}
        emptyLabel={t('usersPage.form.noCredentialGroups')}
        groups={channelGroups}
        selected={channelGroupIds}
        onToggle={toggleChannelGroup}
      />
      <GroupCheckboxList
        label={t('usersPage.scopes.model')}
        emptyLabel={t('usersPage.form.noModelGroups')}
        groups={modelGroups}
        selected={modelGroupIds}
        onToggle={toggleModelGroup}
      />
      <p className="text-muted-foreground text-sm leading-6">
        {t('usersPage.keys.emptyScopeHint')}
      </p>
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
          {mode === 'create' ? t('usersPage.actions.createKey') : t('usersPage.actions.save')}
        </Button>
      </div>
    </form>
  )
}

function GroupForm({
  kind,
  group,
  mutating,
  onCancel,
  onSubmit,
}: {
  kind: AccessGroupKind
  group: AccessGroupResource | null
  mutating: boolean
  onCancel: () => void
  onSubmit: (input: { name: string; disabled: boolean }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [disabled, setDisabled] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setLocalError(null)
    setName(group?.name ?? '')
    setDisabled(group?.disabled ?? false)
  }, [group])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setLocalError(t('usersPage.form.validation.groupNameRequired'))
      return
    }

    try {
      setLocalError(null)
      await onSubmit({ name: trimmedName, disabled })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <form className="grid gap-4 p-5" onSubmit={(event) => void handleSubmit(event)}>
      <label className="grid gap-2 text-sm font-medium">
        <span>
          {kind === 'channel' ? t('usersPage.groups.channelName') : t('usersPage.groups.modelName')}
        </span>
        <Input
          value={name}
          disabled={mutating}
          placeholder={kind === 'channel' ? 'team-a' : 'premium-models'}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={disabled}
          disabled={mutating}
          onCheckedChange={(checked) => setDisabled(checked === true)}
        />
        <span className="grid gap-1">
          <span className="font-medium">{t('usersPage.groups.disabled')}</span>
          <span className="text-muted-foreground">{t('usersPage.groups.disabledHint')}</span>
        </span>
      </label>
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
          {group
            ? t('usersPage.actions.save')
            : kind === 'channel'
              ? t('usersPage.actions.createCredentialScope')
              : t('usersPage.actions.createModelScope')}
        </Button>
      </div>
    </form>
  )
}

function GroupDetailForm({
  kind,
  groups,
  initialGroupId,
  mutating,
  onCancel,
  onSubmit,
}: {
  kind: AccessGroupKind
  groups: AccessGroupResource[]
  initialGroupId?: number
  mutating: boolean
  onCancel: () => void
  onSubmit: (input: { groupId: number; targetId: string }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [groupId, setGroupId] = useState<number | null>(
    initialGroupId ?? groups[0]?.numericId ?? null,
  )
  const [targetId, setTargetId] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setLocalError(null)
    setGroupId(initialGroupId ?? groups[0]?.numericId ?? null)
    setTargetId('')
  }, [groups, initialGroupId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!groupId) {
      setLocalError(t('usersPage.form.validation.groupRequired'))
      return
    }

    if (!targetId.trim()) {
      setLocalError(
        kind === 'channel'
          ? t('usersPage.form.validation.authRequired')
          : t('usersPage.form.validation.modelRequired'),
      )
      return
    }

    try {
      setLocalError(null)
      await onSubmit({ groupId, targetId: targetId.trim() })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <form className="grid gap-4 p-5" onSubmit={(event) => void handleSubmit(event)}>
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('usersPage.groups.group')}</span>
        <Select
          value={groupId ? String(groupId) : ''}
          disabled={mutating || groups.length === 0}
          onValueChange={(value) => setGroupId(Number(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('usersPage.groups.groupPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group.id} value={String(group.numericId)}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        <span>
          {kind === 'channel' ? t('usersPage.groups.authId') : t('usersPage.groups.modelId')}
        </span>
        <Input
          value={targetId}
          disabled={mutating}
          placeholder={kind === 'channel' ? 'auth-db-id' : 'gpt-5'}
          onChange={(event) => setTargetId(event.target.value)}
        />
      </label>
      {localError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {localError}
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutating || groups.length === 0}>
          {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('usersPage.actions.addBinding')}
        </Button>
      </div>
    </form>
  )
}

function UserDetailContent({
  user,
  accessKeys,
  channelGroups,
  modelGroups,
}: {
  user: UserResource
  accessKeys: AccessKeyResource[]
  channelGroups: AccessGroupResource[]
  modelGroups: AccessGroupResource[]
}) {
  const { t } = useTranslation()
  const keys = getUserKeys(accessKeys, user)
  const credentialScopeIds = getUnion(keys.map((key) => key.channelGroupIds))
  const modelScopeIds = getUnion(keys.map((key) => key.modelGroupIds))

  return (
    <div className="grid gap-5 p-5">
      <div className="rounded-md border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge deletedAt={user.deletedAt} />
          {user.hasPassword ? (
            <span className="bg-muted text-muted-foreground rounded-md border px-2 py-1 text-xs">
              {t('usersPage.detail.passwordStored')}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-base font-semibold">{user.username}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('usersPage.detail.userId', { id: user.id })}
        </p>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold">{t('usersPage.detail.sections.profile')}</h3>
        <dl className="grid gap-2 text-sm">
          {[
            ['createdAt', formatOptionalTime(user.createdAt, t('usersPage.status.notReturned'))],
            ['updatedAt', formatOptionalTime(user.updatedAt, t('usersPage.status.notReturned'))],
            ['deletedAt', formatOptionalTime(user.deletedAt, t('usersPage.status.notDeleted'))],
            ['mfa', user.mfaConfigured ? t('common.enabled') : t('common.disabled')],
            ['passkeyCount', formatNumber(user.passkeyCount)],
          ].map(([key, value]) => (
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
        <h3 className="text-sm font-semibold">{t('usersPage.detail.sections.access')}</h3>
        <div className="grid gap-2 text-sm">
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs">{t('usersPage.list.keys')}</p>
            <p className="mt-1 font-medium">{formatNumber(keys.length)}</p>
          </div>
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs">{t('usersPage.scopes.credential')}</p>
            <p className="mt-1 break-words">
              {groupListLabel(
                channelGroups,
                credentialScopeIds,
                t('usersPage.scopes.unrestricted'),
              )}
            </p>
          </div>
          <div className="rounded-md border px-3 py-2.5">
            <p className="text-muted-foreground text-xs">{t('usersPage.scopes.model')}</p>
            <p className="mt-1 break-words">
              {groupListLabel(modelGroups, modelScopeIds, t('usersPage.scopes.unrestricted'))}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function UsersTable({
  users,
  accessKeys,
  channelGroups,
  modelGroups,
  onView,
  onEdit,
  onDelete,
}: {
  users: UserResource[]
  accessKeys: AccessKeyResource[]
  channelGroups: AccessGroupResource[]
  modelGroups: AccessGroupResource[]
  onView: (user: UserResource) => void
  onEdit: (user: UserResource) => void
  onDelete: (user: UserResource) => void
}) {
  const { t } = useTranslation()

  if (users.length === 0) {
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
              <TableHead>{t('usersPage.list.status')}</TableHead>
              <TableHead>{t('usersPage.list.keys')}</TableHead>
              <TableHead>{t('usersPage.scopes.credential')}</TableHead>
              <TableHead>{t('usersPage.scopes.model')}</TableHead>
              <TableHead>{t('usersPage.list.updatedAt')}</TableHead>
              <TableHead className="bg-muted sticky right-0 z-10 w-[220px] text-right">
                {t('usersPage.list.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const keys = getUserKeys(accessKeys, user)
              const credentialScopeIds = getUnion(keys.map((key) => key.channelGroupIds))
              const modelScopeIds = getUnion(keys.map((key) => key.modelGroupIds))

              return (
                <TableRow key={user.id} className="hover:bg-accent/40 group transition-colors">
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium">{user.username}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge deletedAt={user.deletedAt} />
                  </TableCell>
                  <TableCell>{formatNumber(keys.length)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {groupListLabel(
                      channelGroups,
                      credentialScopeIds,
                      t('usersPage.scopes.unrestricted'),
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {groupListLabel(modelGroups, modelScopeIds, t('usersPage.scopes.unrestricted'))}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatOptionalTime(user.updatedAt, t('usersPage.status.notReturned'))}
                  </TableCell>
                  <TableCell className="group-hover:bg-accent bg-card sticky right-0 z-10 text-right transition-colors">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="text"
                        size="sm"
                        className="px-2"
                        onClick={() => onView(user)}
                      >
                        <Eye className="size-4" aria-hidden="true" />
                        {t('usersPage.actions.view')}
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        className="px-2"
                        onClick={() => onEdit(user)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        {t('usersPage.actions.edit')}
                      </Button>
                      <Button
                        variant="destructiveText"
                        size="sm"
                        className="px-2"
                        onClick={() => onDelete(user)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        {t('usersPage.actions.delete')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AccessKeysTable({
  keys,
  users,
  channelGroups,
  modelGroups,
  onEdit,
  onDelete,
}: {
  keys: AccessKeyResource[]
  users: UserResource[]
  channelGroups: AccessGroupResource[]
  modelGroups: AccessGroupResource[]
  onEdit: (key: AccessKeyResource) => void
  onDelete: (key: AccessKeyResource) => void
}) {
  const { t } = useTranslation()

  if (keys.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border px-4 py-10 text-center text-sm">
        {t('usersPage.keys.empty')}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <Table className="min-w-[920px]">
          <TableHeader className="bg-muted/70 text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('usersPage.keys.key')}</TableHead>
              <TableHead>{t('usersPage.keys.owner')}</TableHead>
              <TableHead>{t('usersPage.scopes.credential')}</TableHead>
              <TableHead>{t('usersPage.scopes.model')}</TableHead>
              <TableHead>{t('usersPage.keys.length')}</TableHead>
              <TableHead className="bg-muted sticky right-0 z-10 w-[180px] text-right">
                {t('usersPage.list.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id} className="hover:bg-accent/40 group transition-colors">
                <TableCell>
                  <p className="font-mono text-xs">{key.maskedValue}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t('usersPage.keys.sequence', { index: key.index + 1 })}
                  </p>
                </TableCell>
                <TableCell>
                  {userLabel(users, key.userId) ?? (
                    <span className="text-muted-foreground">{t('usersPage.keys.unassigned')}</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[240px] truncate">
                  {groupListLabel(
                    channelGroups,
                    key.channelGroupIds,
                    t('usersPage.scopes.unrestricted'),
                  )}
                </TableCell>
                <TableCell className="max-w-[240px] truncate">
                  {groupListLabel(
                    modelGroups,
                    key.modelGroupIds,
                    t('usersPage.scopes.unrestricted'),
                  )}
                </TableCell>
                <TableCell>{key.length}</TableCell>
                <TableCell className="group-hover:bg-accent bg-card sticky right-0 z-10 text-right transition-colors">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="text" size="sm" className="px-2" onClick={() => onEdit(key)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      {t('usersPage.actions.edit')}
                    </Button>
                    <Button
                      variant="destructiveText"
                      size="sm"
                      className="px-2"
                      onClick={() => onDelete(key)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t('usersPage.actions.delete')}
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

function GroupsTable({
  kind,
  groups,
  details,
  onEditGroup,
  onDeleteGroup,
  onAddDetail,
  onDeleteDetail,
}: {
  kind: AccessGroupKind
  groups: AccessGroupResource[]
  details: AccessGroupDetailResource[]
  onEditGroup: (group: AccessGroupResource) => void
  onDeleteGroup: (group: AccessGroupResource) => void
  onAddDetail: (group: AccessGroupResource) => void
  onDeleteDetail: (detail: AccessGroupDetailResource) => void
}) {
  const { t } = useTranslation()

  if (groups.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border px-4 py-10 text-center text-sm">
        {kind === 'channel' ? t('usersPage.groups.channelEmpty') : t('usersPage.groups.modelEmpty')}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {groups.map((group) => {
        const groupDetails = details.filter((detail) => detail.groupId === group.numericId)

        return (
          <div key={group.id} className="rounded-md border">
            <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{group.name}</p>
                  <span className="bg-muted text-muted-foreground rounded-md border px-2 py-1 text-xs">
                    {t('usersPage.groups.detailCount', { count: groupDetails.length })}
                  </span>
                  {group.disabled ? (
                    <span className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-2 py-1 text-xs">
                      {t('usersPage.groups.disabled')}
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t('usersPage.groups.groupId', { id: group.numericId })}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 md:justify-end">
                <Button variant="outline" size="sm" onClick={() => onAddDetail(group)}>
                  <Plus className="size-4" aria-hidden="true" />
                  {t('usersPage.actions.addBinding')}
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  className="px-2"
                  onClick={() => onEditGroup(group)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  {t('usersPage.actions.edit')}
                </Button>
                <Button
                  variant="destructiveText"
                  size="sm"
                  className="px-2"
                  onClick={() => onDeleteGroup(group)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t('usersPage.actions.delete')}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[620px]">
                <TableHeader className="bg-muted/40 text-muted-foreground">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>
                      {kind === 'channel'
                        ? t('usersPage.groups.authId')
                        : t('usersPage.groups.modelId')}
                    </TableHead>
                    <TableHead>{t('usersPage.list.updatedAt')}</TableHead>
                    <TableHead className="w-[120px] text-right">
                      {t('usersPage.list.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupDetails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                        {t('usersPage.groups.noDetails')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupDetails.map((detail) => (
                      <TableRow key={detail.id}>
                        <TableCell className="font-mono text-xs">{detail.targetId}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatOptionalTime(detail.updatedAt, t('usersPage.status.notReturned'))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructiveText"
                            size="sm"
                            className="px-2"
                            onClick={() => onDeleteDetail(detail)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            {t('usersPage.actions.delete')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function UsersWorkbenchPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<UsersAccessTab>('users')
  const [search, setSearch] = useState('')
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const selectedUserId =
    sheetMode?.type === 'user-detail' || sheetMode?.type === 'user-edit' ? sheetMode.user.id : null
  const workbench = useUserWorkbench(selectedUserId)

  const users = workbench.users
  const accessKeys = workbench.accessKeys
  const channelGroups = workbench.groups?.channelGroups ?? []
  const channelGroupDetails = workbench.groups?.channelGroupDetails ?? []
  const modelGroups = workbench.groups?.modelGroups ?? []
  const modelGroupDetails = workbench.groups?.modelGroupDetails ?? []
  const accessGroupsAvailable = workbench.capabilities.accessGroups
  const normalizedSearch = search.trim().toLowerCase()
  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        normalizedSearch
          ? [user.id, user.username].join(' ').toLowerCase().includes(normalizedSearch)
          : true,
      ),
    [normalizedSearch, users],
  )
  const filteredKeys = useMemo(
    () =>
      accessKeys.filter((key) =>
        normalizedSearch
          ? [
              key.value,
              key.maskedValue,
              userLabel(users, key.userId) ?? '',
              groupListLabel(channelGroups, key.channelGroupIds, ''),
              groupListLabel(modelGroups, key.modelGroupIds, ''),
            ]
              .join(' ')
              .toLowerCase()
              .includes(normalizedSearch)
          : true,
      ),
    [accessKeys, channelGroups, modelGroups, normalizedSearch, users],
  )
  const filteredChannelGroups = useMemo(
    () =>
      channelGroups.filter((group) =>
        normalizedSearch
          ? createGroupSearchText(group, channelGroupDetails).includes(normalizedSearch)
          : true,
      ),
    [channelGroupDetails, channelGroups, normalizedSearch],
  )
  const filteredModelGroups = useMemo(
    () =>
      modelGroups.filter((group) =>
        normalizedSearch
          ? createGroupSearchText(group, modelGroupDetails).includes(normalizedSearch)
          : true,
      ),
    [modelGroupDetails, modelGroups, normalizedSearch],
  )
  const activeUsers = users.filter((user) => !user.deletedAt)
  const assignedKeyCount = accessKeys.filter((key) => key.userId !== null).length

  if (!workbench.connected) return <UsersDisconnectedState />
  if (!workbench.capabilityReady) return <UsersLoadingState />
  if (!workbench.capabilities.users) {
    return <UsersUnsupportedState runtimeLabel={t(`runtimeMode.${workbench.runtimeMode}`)} />
  }
  if (workbench.isPending) return <UsersLoadingState />
  if (workbench.isError) {
    return <UsersErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
  }

  const closeSheet = () => setSheetMode(null)

  const handleDelete = async () => {
    if (!pendingDelete) return

    if (pendingDelete.type === 'user') {
      await workbench.deleteUser(pendingDelete.user)
      toast.success(t('usersPage.toast.userDeleted'))
    } else if (pendingDelete.type === 'key') {
      await workbench.deleteAccessKey(pendingDelete.key)
      toast.success(t('usersPage.toast.keyDeleted'))
    } else if (pendingDelete.type === 'group') {
      await workbench.deleteGroup(pendingDelete.group)
      toast.success(t('usersPage.toast.groupDeleted'))
    } else {
      await workbench.deleteGroupDetail(pendingDelete.detail)
      toast.success(t('usersPage.toast.bindingDeleted'))
    }

    setPendingDelete(null)
  }

  const sheetTitle =
    sheetMode?.type === 'user-create'
      ? t('usersPage.form.createTitle')
      : sheetMode?.type === 'user-edit'
        ? t('usersPage.form.editTitle')
        : sheetMode?.type === 'user-detail'
          ? t('usersPage.detail.title')
          : sheetMode?.type === 'key-create'
            ? t('usersPage.keys.createTitle')
            : sheetMode?.type === 'key-edit'
              ? t('usersPage.keys.editTitle')
              : sheetMode?.type === 'group-create'
                ? t(`usersPage.groups.${sheetMode.kind}CreateTitle`)
                : sheetMode?.type === 'group-edit'
                  ? t(`usersPage.groups.${sheetMode.group.kind}EditTitle`)
                  : sheetMode?.type === 'detail-create'
                    ? t(`usersPage.groups.${sheetMode.kind}BindingTitle`)
                    : ''
  const sheetDescription =
    sheetMode?.type === 'user-create'
      ? t('usersPage.sheet.userCreateDescription')
      : sheetMode?.type === 'user-edit'
        ? t('usersPage.sheet.userEditDescription')
        : sheetMode?.type === 'user-detail'
          ? t('usersPage.sheet.userDetailDescription')
          : sheetMode?.type === 'key-create'
            ? t('usersPage.sheet.keyCreateDescription')
            : sheetMode?.type === 'key-edit'
              ? t('usersPage.sheet.keyEditDescription')
              : sheetMode?.type === 'group-create'
                ? sheetMode.kind === 'channel'
                  ? t('usersPage.sheet.channelGroupCreateDescription')
                  : t('usersPage.sheet.modelGroupCreateDescription')
                : sheetMode?.type === 'group-edit'
                  ? sheetMode.group.kind === 'channel'
                    ? t('usersPage.sheet.channelGroupEditDescription')
                    : t('usersPage.sheet.modelGroupEditDescription')
                  : sheetMode?.type === 'detail-create'
                    ? sheetMode.kind === 'channel'
                      ? t('usersPage.sheet.channelBindingDescription')
                      : t('usersPage.sheet.modelBindingDescription')
                    : ''

  return (
    <section className="grid gap-5">
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal">{t('usersPage.header.title')}</h1>
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
            <Button size="sm" onClick={() => setSheetMode({ type: 'user-create' })}>
              <Plus className="size-4" aria-hidden="true" />
              {t('usersPage.actions.newUser')}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
            {t('usersPage.header.users', { count: users.length })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usersPage.header.activeUsers', { count: activeUsers.length })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usersPage.header.keys', { count: accessKeys.length })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usersPage.header.assignedKeys', { count: assignedKeyCount })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('usersPage.header.updatedAt', {
              time: formatOptionalTime(workbench.fetchedAt, t('usersPage.status.notReturned')),
            })}
          </span>
        </div>
      </div>

      <div className="bg-card min-w-0 rounded-lg border p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t('usersPage.workspace.title')}</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('usersPage.workspace.description')}
            </p>
          </div>
          <div className="relative min-w-0 lg:w-80">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('usersPage.workspace.filterPlaceholder')}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['users', 'keys', 'channelGroups', 'modelGroups'] as UsersAccessTab[]).map((tab) => (
            <Button
              key={tab}
              type="button"
              variant={activeTab === tab ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'users' ? (
                <UsersRound className="size-4" aria-hidden="true" />
              ) : tab === 'keys' ? (
                <KeyRound className="size-4" aria-hidden="true" />
              ) : tab === 'channelGroups' ? (
                <ShieldCheck className="size-4" aria-hidden="true" />
              ) : (
                <Layers3 className="size-4" aria-hidden="true" />
              )}
              {t(`usersPage.tabs.${tab}`)}
            </Button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === 'users' ? (
            <UsersTable
              users={filteredUsers}
              accessKeys={accessKeys}
              channelGroups={channelGroups}
              modelGroups={modelGroups}
              onView={(user) => setSheetMode({ type: 'user-detail', user })}
              onEdit={(user) => setSheetMode({ type: 'user-edit', user })}
              onDelete={(user) => setPendingDelete({ type: 'user', user })}
            />
          ) : activeTab === 'keys' ? (
            <div className="grid gap-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setSheetMode({ type: 'key-create' })}>
                  <Plus className="size-4" aria-hidden="true" />
                  {t('usersPage.actions.newKey')}
                </Button>
              </div>
              <AccessKeysTable
                keys={filteredKeys}
                users={users}
                channelGroups={channelGroups}
                modelGroups={modelGroups}
                onEdit={(key) => setSheetMode({ type: 'key-edit', key })}
                onDelete={(key) => setPendingDelete({ type: 'key', key })}
              />
            </div>
          ) : activeTab === 'channelGroups' ? (
            accessGroupsAvailable ? (
              <div className="grid gap-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setSheetMode({ type: 'group-create', kind: 'channel' })}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {t('usersPage.actions.newCredentialScope')}
                  </Button>
                </div>
                <GroupsTable
                  kind="channel"
                  groups={filteredChannelGroups}
                  details={channelGroupDetails}
                  onEditGroup={(group) => setSheetMode({ type: 'group-edit', group })}
                  onDeleteGroup={(group) => setPendingDelete({ type: 'group', group })}
                  onAddDetail={(group) =>
                    setSheetMode({
                      type: 'detail-create',
                      kind: 'channel',
                      groupId: group.numericId,
                    })
                  }
                  onDeleteDetail={(detail) => setPendingDelete({ type: 'detail', detail })}
                />
              </div>
            ) : (
              <AccessGroupsUnsupportedState />
            )
          ) : accessGroupsAvailable ? (
            <div className="grid gap-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setSheetMode({ type: 'group-create', kind: 'model' })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t('usersPage.actions.newModelScope')}
                </Button>
              </div>
              <GroupsTable
                kind="model"
                groups={filteredModelGroups}
                details={modelGroupDetails}
                onEditGroup={(group) => setSheetMode({ type: 'group-edit', group })}
                onDeleteGroup={(group) => setPendingDelete({ type: 'group', group })}
                onAddDetail={(group) =>
                  setSheetMode({ type: 'detail-create', kind: 'model', groupId: group.numericId })
                }
                onDeleteDetail={(detail) => setPendingDelete({ type: 'detail', detail })}
              />
            </div>
          ) : (
            <AccessGroupsUnsupportedState />
          )}
        </div>
      </div>

      <Sheet open={Boolean(sheetMode)} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-5">
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>{sheetDescription}</SheetDescription>
          </SheetHeader>
          {sheetMode?.type === 'user-create' || sheetMode?.type === 'user-edit' ? (
            <UserForm
              mode={sheetMode.type === 'user-create' ? 'create' : 'edit'}
              user={sheetMode.type === 'user-edit' ? sheetMode.user : null}
              mutating={workbench.mutating}
              onCancel={closeSheet}
              onSubmit={async (input) => {
                if (sheetMode.type === 'user-create') {
                  await workbench.createUser(input)
                  toast.success(t('usersPage.toast.userCreated'))
                  closeSheet()
                } else {
                  await workbench.updateUser({ user: sheetMode.user, input })
                  toast.success(t('usersPage.toast.userUpdated'))
                  closeSheet()
                }
              }}
            />
          ) : sheetMode?.type === 'user-detail' ? (
            <UserDetailContent
              user={workbench.selectedUser ?? sheetMode.user}
              accessKeys={accessKeys}
              channelGroups={channelGroups}
              modelGroups={modelGroups}
            />
          ) : sheetMode?.type === 'key-create' || sheetMode?.type === 'key-edit' ? (
            <AccessKeyForm
              mode={sheetMode.type === 'key-create' ? 'create' : 'edit'}
              accessKey={sheetMode.type === 'key-edit' ? sheetMode.key : null}
              users={users}
              channelGroups={channelGroups}
              modelGroups={modelGroups}
              mutating={workbench.mutating}
              onCancel={closeSheet}
              onSubmit={async (input) => {
                if (sheetMode.type === 'key-create') {
                  await workbench.createAccessKey(input)
                  toast.success(t('usersPage.toast.keyCreated'))
                } else {
                  await workbench.updateAccessKeyBindings({
                    resource: sheetMode.key,
                    input,
                  })
                  toast.success(t('usersPage.toast.keyUpdated'))
                }
                closeSheet()
              }}
            />
          ) : sheetMode?.type === 'group-create' || sheetMode?.type === 'group-edit' ? (
            <GroupForm
              kind={sheetMode.type === 'group-create' ? sheetMode.kind : sheetMode.group.kind}
              group={sheetMode.type === 'group-edit' ? sheetMode.group : null}
              mutating={workbench.mutating}
              onCancel={closeSheet}
              onSubmit={async (input) => {
                if (sheetMode.type === 'group-create') {
                  await workbench.createGroup({ kind: sheetMode.kind, input })
                  toast.success(t('usersPage.toast.groupCreated'))
                } else {
                  await workbench.updateGroup({ group: sheetMode.group, input })
                  toast.success(t('usersPage.toast.groupUpdated'))
                }
                closeSheet()
              }}
            />
          ) : sheetMode?.type === 'detail-create' ? (
            <GroupDetailForm
              kind={sheetMode.kind}
              groups={sheetMode.kind === 'channel' ? channelGroups : modelGroups}
              initialGroupId={sheetMode.groupId}
              mutating={workbench.mutating}
              onCancel={closeSheet}
              onSubmit={async (input) => {
                await workbench.createGroupDetail({ kind: sheetMode.kind, input })
                toast.success(t('usersPage.toast.bindingCreated'))
                closeSheet()
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('usersPage.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? t(`usersPage.delete.${pendingDelete.type}`, {
                    name:
                      pendingDelete.type === 'user'
                        ? pendingDelete.user.username
                        : pendingDelete.type === 'key'
                          ? pendingDelete.key.maskedValue
                          : pendingDelete.type === 'group'
                            ? pendingDelete.group.name
                            : pendingDelete.detail.targetId,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white"
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('usersPage.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
