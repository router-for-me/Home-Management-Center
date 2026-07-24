import {
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { TFunction } from 'i18next'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DrawerScaffoldBody,
  DrawerScaffoldContent,
  DrawerScaffoldFooter,
  DrawerScaffoldHeader,
} from '@/components/shared/drawer-scaffold'
import { TableEmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import {
  TableSurface,
  TableSurfaceHeader,
  containedTableContainerClassName,
  stickyTableHeaderClassName,
} from '@/components/shared/table-surface'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  type CredentialBindingCandidate,
  type ModelBindingCandidate,
  useUserWorkbench,
} from '@/features/users/use-user-workbench'
import type {
  AccessGroupDetailResource,
  AccessGroupKind,
  AccessGroupResource,
} from '@/lib/api/management/access-groups'
import type { AccessKeyResource } from '@/lib/api/management/access-keys'
import {
  type UserApiFieldError,
  type UserFormInput,
  type UserPeriodLimitsStatus,
  type UserPeriodLimitsSummary,
  type UserPeriodResetInput,
  type UserPeriodResetMode,
  type UserPeriodWindowConfig,
  type UserPeriodWindowId,
  type UserPeriodWindowMode,
  type UserPeriodWindowStatus,
  type UserResource,
  defaultUserPeriodTimezone,
  defaultUserPeriodWeekResetDay,
  defaultUserPeriodWeekResetHour,
  getUserApiFieldErrors,
  userPeriodWindowIds,
} from '@/lib/api/management/users'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type UsersAccessTab = 'users' | 'keys' | 'channelGroups' | 'modelGroups'
type ModelSourceFilter = 'all' | 'available' | 'static'
type SheetMode =
  | { type: 'user-create' }
  | { type: 'user-edit'; user: UserResource }
  | { type: 'user-detail'; user: UserResource }
  | { type: 'balance'; targets: BalanceOperationTarget[] }
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
type PendingBalanceOperation = {
  operation: 'recharge' | 'deduct'
  targets: BalanceOperationTarget[]
  amount: number
  note: string
  currentTotal: number
  nextTotal: number
  negativeTargetCount: number
}
type BalanceOperationDraft = PendingBalanceOperation
type BalanceOperationTarget = {
  id: string
  numericId: number
  username: string
  credits: number
}
type BindingCandidateOption = {
  id: string
  value: string
  label: string
  description: string
  badges: Array<{
    label: string
    className?: string
  }>
  disabled?: boolean
}
type BindingCandidateFilterOption = {
  value: string
  label: string
}

const unassignedUserValue = '__unassigned__'
const modelSourceFilters: ModelSourceFilter[] = ['all', 'available', 'static']

const userPeriodTimezoneSuggestions = [
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Tokyo',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
]

type UserPeriodWindowDraft = {
  enabled: boolean
  limit: string
  mode: UserPeriodWindowMode
}

function windowModesFor(id: UserPeriodWindowId): UserPeriodWindowMode[] {
  return id === '5h' ? ['first_use', 'sliding'] : ['first_use', 'sliding', 'calendar']
}

function createWindowDrafts(user: UserResource | null) {
  const draft = (id: UserPeriodWindowId): UserPeriodWindowDraft => {
    const config = user?.periodLimits.supported ? user.periodLimits.windows[id] : null

    return {
      enabled: config ? config.limit !== null : false,
      limit: config?.limit !== null && config?.limit !== undefined ? String(config.limit) : '0',
      mode: config?.mode ?? 'first_use',
    }
  }

  return {
    '5h': draft('5h'),
    '1d': draft('1d'),
    '7d': draft('7d'),
    '30d': draft('30d'),
  }
}

type UserPeriodWindowVisualStatus = 'disabled' | 'notStarted' | 'active' | 'exhausted'

const periodWindowStatusClassNames: Record<UserPeriodWindowVisualStatus, string> = {
  disabled: 'border-border bg-muted/50 text-muted-foreground',
  notStarted: 'border-info/25 bg-info/10 text-info',
  active: 'border-success/30 bg-success/10 text-success',
  exhausted: 'border-destructive/30 bg-destructive/10 text-destructive',
}

type UserFormFieldError = {
  anchor: 'username' | 'timezone' | UserPeriodWindowId | null
  message: string
}

// Maps Management API field_errors entries to localized, form-anchored
// messages. Entries the form cannot anchor keep a null anchor and are
// surfaced through the generic error box with the raw backend message.
function mapUserFormFieldErrors(
  t: TFunction,
  fieldErrors: UserApiFieldError[],
): UserFormFieldError[] {
  return fieldErrors.map((fieldError) => {
    if (fieldError.field === 'username') {
      return { anchor: 'username', message: t('usersPage.form.validation.usernameRequired') }
    }
    if (fieldError.field === 'timezone') {
      return { anchor: 'timezone', message: t('usersPage.form.validation.timezoneInvalid') }
    }

    const limitMatch = /^limit_(5h|1d|7d|30d)_credits$/.exec(fieldError.field)
    if (limitMatch) {
      const windowId = limitMatch[1] as UserPeriodWindowId
      return {
        anchor: windowId,
        message: t('usersPage.form.validation.limitInvalid', {
          window: t(`usersPage.periodLimits.windows.${windowId}`),
        }),
      }
    }

    const modeMatch = /^window_mode_(5h|1d|7d|30d)$/.exec(fieldError.field)
    if (modeMatch) {
      const windowId = modeMatch[1] as UserPeriodWindowId
      return {
        anchor: windowId,
        message: t('usersPage.form.validation.windowModeInvalid', {
          window: t(`usersPage.periodLimits.windows.${windowId}`),
        }),
      }
    }

    if (fieldError.field === 'week_reset_day') {
      return { anchor: '7d', message: t('usersPage.form.validation.weekResetDayInvalid') }
    }
    if (fieldError.field === 'week_reset_hour') {
      return { anchor: '7d', message: t('usersPage.form.validation.weekResetHourInvalid') }
    }

    return { anchor: null, message: '' }
  })
}

function mapPeriodResetFieldErrors(t: TFunction, fieldErrors: UserApiFieldError[]): string[] {
  return fieldErrors.map((fieldError) => {
    if (fieldError.field === 'mode') {
      return t('usersPage.periodLimits.reset.validation.modeInvalid')
    }
    if (fieldError.field === 'windows') {
      return t('usersPage.periodLimits.reset.validation.windowsInvalid')
    }
    return ''
  })
}

function UserPeriodLimitsTableBadge({ summary }: { summary: UserPeriodLimitsSummary | null }) {
  const { t } = useTranslation()

  if (!summary) {
    return <span className="text-muted-foreground">—</span>
  }

  if (summary.zeroLimitWindows.length > 0) {
    const windows = summary.zeroLimitWindows.join(', ')
    const label = t('usersPage.periodLimits.tableBlocked', { windows })

    return (
      <span
        className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning inline-flex max-w-full items-center truncate rounded-md border px-2 py-1 text-xs font-medium"
        title={label}
      >
        {label}
      </span>
    )
  }

  if (summary.enabledWindows.length > 0) {
    return (
      <span className="bg-muted/50 text-muted-foreground inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium">
        {t('usersPage.periodLimits.tableEnabled', { count: summary.enabledWindows.length })}
      </span>
    )
  }

  return <span className="text-muted-foreground">—</span>
}

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

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)
}

function formatSignedAmount(value: number) {
  const absolute = formatMoney(Math.abs(value))
  return value >= 0 ? `+${absolute}` : `-${absolute}`
}

function formatBalanceTargetIdentity(target: BalanceOperationTarget) {
  return `${target.username} (#${target.numericId})`
}

function toBalanceOperationTarget(user: UserResource): BalanceOperationTarget | null {
  if (user.numericId === null || user.deletedAt) return null

  return {
    id: user.id,
    numericId: user.numericId,
    username: user.username,
    credits: user.credits,
  }
}

function isBalanceOperationTarget(
  target: BalanceOperationTarget | null,
): target is BalanceOperationTarget {
  return target !== null
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
  const { t } = useTranslation()

  return (
    <section className="grid gap-5">
      <PageHeader
        title={t('usersPage.loading.title')}
        description={t('usersPage.loading.description')}
        tags={<Skeleton className="h-7 w-32 rounded-md" />}
      />
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
  periodLimitsSupported,
  mutating,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  user: UserResource | null
  periodLimitsSupported: boolean
  mutating: boolean
  onCancel: () => void
  onSubmit: (input: UserFormInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [credits, setCredits] = useState('0')
  const [creditsUnlimited, setCreditsUnlimited] = useState(false)
  const [timezone, setTimezone] = useState(defaultUserPeriodTimezone)
  const [windowDrafts, setWindowDrafts] = useState<
    Record<UserPeriodWindowId, UserPeriodWindowDraft>
  >(() => createWindowDrafts(null))
  const [weekResetDay, setWeekResetDay] = useState(String(defaultUserPeriodWeekResetDay))
  const [weekResetHour, setWeekResetHour] = useState(String(defaultUserPeriodWeekResetHour))
  const [localError, setLocalError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<UserFormFieldError[]>([])

  useEffect(() => {
    const editUser = mode === 'edit' ? user : null
    setLocalError(null)
    setFieldErrors([])
    setUsername(editUser ? editUser.username : '')
    setPassword('')
    setCredits(editUser ? String(editUser.credits) : '0')
    setCreditsUnlimited(editUser?.creditsUnlimited ?? false)
    setTimezone(editUser?.periodLimits.timezone || defaultUserPeriodTimezone)
    setWindowDrafts(createWindowDrafts(editUser))
    setWeekResetDay(String(editUser?.periodLimits.weekResetDay ?? defaultUserPeriodWeekResetDay))
    setWeekResetHour(String(editUser?.periodLimits.weekResetHour ?? defaultUserPeriodWeekResetHour))
  }, [mode, user])

  const updateWindowDraft = (id: UserPeriodWindowId, patch: Partial<UserPeriodWindowDraft>) => {
    setWindowDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  const fieldErrorFor = (anchor: UserFormFieldError['anchor']) =>
    fieldErrors.find((fieldError) => fieldError.anchor === anchor)?.message ?? null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFieldErrors([])
    const trimmedUsername = username.trim()

    if (!trimmedUsername) {
      setLocalError(t('usersPage.form.validation.usernameRequired'))
      return
    }

    const numericCredits = Number(credits)
    if (!Number.isFinite(numericCredits) || numericCredits < 0) {
      setLocalError(t('usersPage.form.validation.creditsInvalid'))
      return
    }

    let periodLimits: UserFormInput['periodLimits']
    if (periodLimitsSupported) {
      const trimmedTimezone = timezone.trim()
      if (!trimmedTimezone) {
        setLocalError(t('usersPage.form.validation.timezoneRequired'))
        return
      }

      const windows: Record<UserPeriodWindowId, UserPeriodWindowConfig> = {
        '5h': { limit: null, mode: 'first_use' },
        '1d': { limit: null, mode: 'first_use' },
        '7d': { limit: null, mode: 'first_use' },
        '30d': { limit: null, mode: 'first_use' },
      }
      for (const id of userPeriodWindowIds) {
        const draft = windowDrafts[id]
        const numericLimit = Number(draft.limit)
        if (draft.enabled && (!Number.isFinite(numericLimit) || numericLimit < 0)) {
          setLocalError(
            t('usersPage.form.validation.limitInvalid', {
              window: t(`usersPage.periodLimits.windows.${id}`),
            }),
          )
          return
        }
        windows[id] = {
          limit: draft.enabled ? numericLimit : null,
          mode: draft.mode,
        }
      }

      const numericWeekResetHour = Number(weekResetHour)
      if (
        !Number.isInteger(numericWeekResetHour) ||
        numericWeekResetHour < 0 ||
        numericWeekResetHour > 23
      ) {
        setLocalError(t('usersPage.form.validation.weekResetHourInvalid'))
        return
      }

      periodLimits = {
        creditsUnlimited,
        timezone: trimmedTimezone,
        windows,
        weekResetDay: Number(weekResetDay),
        weekResetHour: numericWeekResetHour,
      }
    }

    try {
      setLocalError(null)
      setFieldErrors([])
      await onSubmit({
        username: trimmedUsername,
        password: password.trim() || undefined,
        credits: numericCredits,
        periodLimits,
      })
    } catch (error) {
      const apiFieldErrors = mapUserFormFieldErrors(t, getUserApiFieldErrors(error))
      setFieldErrors(apiFieldErrors)
      const hasAnchored = apiFieldErrors.some((fieldError) => fieldError.anchor !== null)
      setLocalError(hasAnchored ? null : error instanceof Error ? error.message : String(error))
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
          aria-invalid={fieldErrorFor('username') ? true : undefined}
          onChange={(event) => setUsername(event.target.value)}
        />
        {mode === 'edit' ? (
          <span className="text-muted-foreground text-xs leading-5">
            {t('usersPage.form.usernameLockedHint')}
          </span>
        ) : null}
        {fieldErrorFor('username') ? (
          <span className="text-destructive text-xs leading-5">{fieldErrorFor('username')}</span>
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
      <label className="grid gap-2 text-sm font-medium">
        <span>{t('usersPage.form.credits')}</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={credits}
          disabled={mutating || (periodLimitsSupported && creditsUnlimited)}
          placeholder={t('usersPage.form.creditsPlaceholder')}
          onChange={(event) => setCredits(event.target.value)}
        />
        <span className="text-muted-foreground text-xs leading-5">
          {periodLimitsSupported && creditsUnlimited
            ? t('usersPage.form.creditsUnlimitedCreditsHint')
            : t('usersPage.form.creditsHint')}
        </span>
      </label>
      {periodLimitsSupported ? (
        <div className="grid gap-3 rounded-md border p-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold">{t('usersPage.periodLimits.sectionTitle')}</p>
            <p className="text-muted-foreground text-xs leading-5">
              {t('usersPage.periodLimits.sectionHint')}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
            <div className="grid gap-1">
              <span className="text-sm font-medium">{t('usersPage.form.creditsUnlimited')}</span>
              <span className="text-muted-foreground text-xs leading-5">
                {t('usersPage.form.creditsUnlimitedHint')}
              </span>
            </div>
            <Switch
              checked={creditsUnlimited}
              disabled={mutating}
              aria-label={t('usersPage.form.creditsUnlimited')}
              onCheckedChange={setCreditsUnlimited}
            />
          </div>
          {userPeriodWindowIds.map((id) => {
            const draft = windowDrafts[id]
            const limitIsZero = draft.enabled && Number(draft.limit) === 0

            return (
              <div key={id} className="grid gap-2 rounded-md border px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {t(`usersPage.periodLimits.windows.${id}`)}
                  </span>
                  <Switch
                    checked={draft.enabled}
                    disabled={mutating}
                    aria-label={t('usersPage.periodLimits.enableWindow', {
                      window: t(`usersPage.periodLimits.windows.${id}`),
                    })}
                    onCheckedChange={(checked) => updateWindowDraft(id, { enabled: checked })}
                  />
                </div>
                {draft.enabled ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-muted-foreground grid gap-1.5 text-xs font-medium">
                      <span>{t('usersPage.periodLimits.limitLabel')}</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.limit}
                        disabled={mutating}
                        aria-invalid={fieldErrorFor(id) ? true : undefined}
                        onChange={(event) => updateWindowDraft(id, { limit: event.target.value })}
                      />
                    </label>
                    <div className="grid gap-1.5">
                      <span className="text-muted-foreground text-xs font-medium">
                        {t('usersPage.periodLimits.modeLabel')}
                      </span>
                      <Select
                        value={draft.mode}
                        disabled={mutating}
                        onValueChange={(value) =>
                          updateWindowDraft(id, { mode: value as UserPeriodWindowMode })
                        }
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label={t('usersPage.periodLimits.modeLabel')}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {windowModesFor(id).map((modeOption) => (
                            <SelectItem key={modeOption} value={modeOption}>
                              {t(`usersPage.periodLimits.modes.${modeOption}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
                {limitIsZero ? (
                  <p className="text-warning-foreground dark:text-warning text-xs leading-5">
                    {t('usersPage.periodLimits.zeroLimitWarning')}
                  </p>
                ) : null}
                {fieldErrorFor(id) ? (
                  <p className="text-destructive text-xs leading-5">{fieldErrorFor(id)}</p>
                ) : null}
                {id === '7d' && draft.enabled && draft.mode === 'calendar' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <span className="text-muted-foreground text-xs font-medium">
                        {t('usersPage.periodLimits.weekResetDay')}
                      </span>
                      <Select
                        value={weekResetDay}
                        disabled={mutating}
                        onValueChange={setWeekResetDay}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label={t('usersPage.periodLimits.weekResetDay')}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                            <SelectItem key={day} value={String(day)}>
                              {t(`usersPage.periodLimits.weekDays.${day}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="text-muted-foreground grid gap-1.5 text-xs font-medium">
                      <span>{t('usersPage.periodLimits.weekResetHour')}</span>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        step="1"
                        value={weekResetHour}
                        disabled={mutating}
                        onChange={(event) => setWeekResetHour(event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            )
          })}
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('usersPage.form.timezone')}</span>
            <Input
              value={timezone}
              list="user-period-timezone-suggestions"
              disabled={mutating}
              placeholder={defaultUserPeriodTimezone}
              aria-invalid={fieldErrorFor('timezone') ? true : undefined}
              onChange={(event) => setTimezone(event.target.value)}
            />
            {fieldErrorFor('timezone') ? (
              <span className="text-destructive text-xs leading-5">
                {fieldErrorFor('timezone')}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs leading-5">
                {t('usersPage.form.timezoneHint')}
              </span>
            )}
          </label>
          <datalist id="user-period-timezone-suggestions">
            {userPeriodTimezoneSuggestions.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-md border border-dashed px-3 py-2.5 text-xs leading-5">
          {t('usersPage.periodLimits.unsupportedForm')}
        </div>
      )}
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

function BindingCandidateMultiSelect({
  title,
  searchValue,
  searchPlaceholder,
  selectedValues,
  selectedCountLabel,
  filteredCountLabel,
  options,
  pending,
  issueMessage,
  errorMessage,
  emptyMessage,
  searchEmptyMessage,
  hint,
  filters,
  filterValue,
  mutating,
  onSearchChange,
  onSelectedValuesChange,
  onFilterChange,
  onRetry,
  onClearError,
}: {
  title: string
  searchValue: string
  searchPlaceholder: string
  selectedValues: string[]
  selectedCountLabel: string
  filteredCountLabel: string
  options: BindingCandidateOption[]
  pending: boolean
  issueMessage: string | null
  errorMessage: string | null
  emptyMessage: string
  searchEmptyMessage: string
  hint: string
  filters?: BindingCandidateFilterOption[]
  filterValue?: string
  mutating: boolean
  onSearchChange: (value: string) => void
  onSelectedValuesChange: Dispatch<SetStateAction<string[]>>
  onFilterChange?: (value: string) => void
  onRetry: () => void
  onClearError: () => void
}) {
  const { t } = useTranslation()
  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues])
  const selectableOptions = options.filter((option) => !option.disabled)
  const allFilteredSelected =
    selectableOptions.length > 0 &&
    selectableOptions.every((option) => selectedValueSet.has(option.value))

  const toggleSelection = (value: string) => {
    onSelectedValuesChange((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
    onClearError()
  }

  const selectFiltered = () => {
    const values = selectableOptions.map((option) => option.value)
    if (values.length === 0) return

    onSelectedValuesChange((current) => [...new Set([...current, ...values])])
    onClearError()
  }

  const invertFiltered = () => {
    const values = new Set(selectableOptions.map((option) => option.value))
    if (values.size === 0) return

    onSelectedValuesChange((current) => {
      const next = new Set(current)

      for (const value of values) {
        if (next.has(value)) {
          next.delete(value)
        } else {
          next.add(value)
        }
      }

      return [...next]
    })
    onClearError()
  }

  const clearSelected = () => {
    onSelectedValuesChange([])
    onClearError()
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return

    event.preventDefault()
    event.stopPropagation()

    const firstSelectableOption = selectableOptions[0]
    if (!firstSelectableOption) return

    toggleSelection(firstSelectableOption.value)
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          value={searchValue}
          disabled={mutating || pending}
          placeholder={searchPlaceholder}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>
      <div className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        {filters?.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground mr-1 text-xs">
              {t('usersPage.groups.modelSourceFilterLabel')}
            </span>
            {filters.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                variant={filterValue === filter.value ? 'secondary' : 'outline'}
                size="xs"
                disabled={mutating || pending}
                onClick={() => onFilterChange?.(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">{filteredCountLabel}</span>
        )}
        <span className="text-muted-foreground text-xs">{selectedCountLabel}</span>
      </div>
      {pending ? (
        <div className="grid gap-2 rounded-md border p-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : errorMessage ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-md border px-3 py-3">
          <p className="text-destructive text-sm">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('usersPage.actions.retry')}
          </Button>
        </div>
      ) : options.length === 0 ? (
        <div className="text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
          {searchValue.trim() ? searchEmptyMessage : emptyMessage}
        </div>
      ) : (
        <div className="grid gap-2">
          {issueMessage ? (
            <div className="border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning rounded-md border px-3 py-2 text-xs leading-5">
              {issueMessage}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={mutating || selectableOptions.length === 0 || allFilteredSelected}
                onClick={selectFiltered}
              >
                {t('usersPage.groups.selectFilteredItems')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={mutating || selectableOptions.length === 0}
                onClick={invertFiltered}
              >
                {t('usersPage.groups.invertFilteredItems')}
              </Button>
              <Button
                type="button"
                variant="text"
                size="xs"
                disabled={mutating || selectedValues.length === 0}
                onClick={clearSelected}
              >
                {t('usersPage.groups.clearSelectedItems')}
              </Button>
            </div>
            <span className="text-muted-foreground text-xs">{filteredCountLabel}</span>
          </div>
          <div className="grid max-h-72 gap-1 overflow-y-auto rounded-md border p-1.5">
            {options.map((option) => {
              const selected = selectedValueSet.has(option.value)
              const disabled = mutating || option.disabled

              return (
                <label
                  key={option.id}
                  className={cn(
                    'flex min-w-0 items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                    selected
                      ? 'bg-primary/10 text-foreground ring-primary/35 ring-1'
                      : 'hover:bg-accent/60',
                    disabled && 'cursor-not-allowed opacity-55',
                  )}
                >
                  <Checkbox
                    checked={selected}
                    disabled={disabled}
                    className="mt-0.5"
                    onCheckedChange={() => toggleSelection(option.value)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{option.label}</span>
                      {option.badges.map((badge, index) => (
                        <span
                          key={`${badge.label}-${index}`}
                          className={cn(
                            'rounded-md border px-1.5 py-0.5 text-[11px]',
                            badge.className ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </span>
                    <span className="text-muted-foreground mt-1 block truncate font-mono text-xs">
                      {option.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}
      <p className="text-muted-foreground text-xs leading-5">{hint}</p>
    </div>
  )
}

function GroupDetailForm({
  kind,
  groups,
  details,
  credentialCandidates,
  credentialCandidatesPending,
  credentialCandidatesIssueMessage,
  credentialCandidatesErrorMessage,
  modelCandidates,
  modelCandidatesPending,
  modelCandidatesIssueMessage,
  modelCandidatesErrorMessage,
  initialGroupId,
  mutating,
  onCancel,
  onRetryCredentialCandidates,
  onRetryModelCandidates,
  onSubmit,
}: {
  kind: AccessGroupKind
  groups: AccessGroupResource[]
  details: AccessGroupDetailResource[]
  credentialCandidates: CredentialBindingCandidate[]
  credentialCandidatesPending: boolean
  credentialCandidatesIssueMessage: string | null
  credentialCandidatesErrorMessage: string | null
  modelCandidates: ModelBindingCandidate[]
  modelCandidatesPending: boolean
  modelCandidatesIssueMessage: string | null
  modelCandidatesErrorMessage: string | null
  initialGroupId?: number
  mutating: boolean
  onCancel: () => void
  onRetryCredentialCandidates: () => void
  onRetryModelCandidates: () => void
  onSubmit: (input: { groupId: number; targetIds: string[] }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [groupId, setGroupId] = useState<number | null>(
    initialGroupId ?? groups[0]?.numericId ?? null,
  )
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])
  const [modelSourceFilter, setModelSourceFilter] = useState<ModelSourceFilter>('all')
  const [credentialSearch, setCredentialSearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const boundTargetIds = useMemo(
    () =>
      new Set(
        details
          .filter((detail) => detail.groupId === groupId && !detail.deletedAt)
          .map((detail) => detail.targetId),
      ),
    [details, groupId],
  )
  const filteredCredentialCandidates = useMemo(() => {
    const normalizedSearch = credentialSearch.trim().toLowerCase()
    if (!normalizedSearch) return credentialCandidates

    return credentialCandidates.filter((candidate) =>
      [
        candidate.label,
        candidate.authId,
        candidate.provider,
        candidate.type,
        candidate.status ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [credentialCandidates, credentialSearch])
  const credentialOptions = useMemo<BindingCandidateOption[]>(
    () =>
      filteredCredentialCandidates.map((candidate) => {
        const alreadyBound = boundTargetIds.has(candidate.authId)
        const unavailable = candidate.disabled || candidate.unavailable

        return {
          id: candidate.id,
          value: candidate.authId,
          label: candidate.label,
          description: candidate.authId,
          disabled: alreadyBound || unavailable,
          badges: [
            { label: candidate.provider },
            ...(alreadyBound
              ? [
                  {
                    label: t('usersPage.groups.credentialAlreadyBound'),
                    className: 'border-success/30 bg-success/10 text-success',
                  },
                ]
              : unavailable
                ? [
                    {
                      label: t('usersPage.groups.credentialUnavailable'),
                      className:
                        'border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning',
                    },
                  ]
                : []),
          ],
        }
      }),
    [boundTargetIds, filteredCredentialCandidates, t],
  )
  const filteredModelCandidates = useMemo(() => {
    const normalizedSearch = modelSearch.trim().toLowerCase()
    const sourceFilteredCandidates =
      modelSourceFilter === 'all'
        ? modelCandidates
        : modelCandidates.filter((candidate) => candidate.scopes.includes(modelSourceFilter))

    if (!normalizedSearch) return sourceFilteredCandidates

    return sourceFilteredCandidates.filter((candidate) =>
      [
        candidate.label,
        candidate.modelId,
        candidate.ownedBy ?? '',
        candidate.type ?? '',
        candidate.channel ?? '',
        candidate.scopes.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [modelCandidates, modelSearch, modelSourceFilter])
  const modelFilterOptions = useMemo<BindingCandidateFilterOption[]>(
    () =>
      modelSourceFilters.map((filter) => ({
        value: filter,
        label: t(`usersPage.groups.modelSourceFilters.${filter}`),
      })),
    [t],
  )
  const modelOptions = useMemo<BindingCandidateOption[]>(
    () =>
      filteredModelCandidates.map((candidate) => {
        const alreadyBound = boundTargetIds.has(candidate.modelId)

        return {
          id: candidate.id,
          value: candidate.modelId,
          label: candidate.label,
          description: candidate.modelId,
          disabled: alreadyBound,
          badges: [
            ...candidate.scopes.map((scope) => ({
              label:
                scope === 'available'
                  ? t('usersPage.groups.modelScopeAvailable')
                  : t('usersPage.groups.modelScopeStatic'),
              className:
                scope === 'available'
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground',
            })),
            ...(candidate.channel ? [{ label: candidate.channel }] : []),
            ...(alreadyBound
              ? [
                  {
                    label: t('usersPage.groups.modelAlreadyBound'),
                    className: 'border-success/30 bg-success/10 text-success',
                  },
                ]
              : []),
          ],
        }
      }),
    [boundTargetIds, filteredModelCandidates, t],
  )

  useEffect(() => {
    setLocalError(null)
    setGroupId(initialGroupId ?? groups[0]?.numericId ?? null)
    setSelectedTargetIds([])
    setModelSourceFilter('all')
    setCredentialSearch('')
    setModelSearch('')
  }, [groups, initialGroupId])

  const handleGroupChange = (value: string) => {
    setGroupId(Number(value))
    setSelectedTargetIds([])
    setLocalError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!groupId) {
      setLocalError(t('usersPage.form.validation.groupRequired'))
      return
    }

    const normalizedTargetIds = [
      ...new Set(selectedTargetIds.map((id) => id.trim()).filter(Boolean)),
    ]

    if (normalizedTargetIds.length === 0) {
      setLocalError(
        kind === 'channel'
          ? t('usersPage.form.validation.authRequired')
          : t('usersPage.form.validation.modelRequired'),
      )
      return
    }

    if (normalizedTargetIds.some((targetId) => boundTargetIds.has(targetId))) {
      setLocalError(
        kind === 'channel'
          ? t('usersPage.form.validation.authAlreadyBound')
          : t('usersPage.form.validation.modelAlreadyBound'),
      )
      return
    }

    try {
      setLocalError(null)
      await onSubmit({ groupId, targetIds: normalizedTargetIds })
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
          onValueChange={handleGroupChange}
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
      {kind === 'channel' ? (
        <BindingCandidateMultiSelect
          title={t('usersPage.groups.credential')}
          searchValue={credentialSearch}
          searchPlaceholder={t('usersPage.groups.credentialSearchPlaceholder')}
          selectedValues={selectedTargetIds}
          selectedCountLabel={t('usersPage.groups.credentialSelectedCount', {
            count: selectedTargetIds.length,
          })}
          filteredCountLabel={t('usersPage.groups.credentialFilteredCount', {
            count: filteredCredentialCandidates.length,
          })}
          options={credentialOptions}
          pending={credentialCandidatesPending}
          issueMessage={credentialCandidatesIssueMessage}
          errorMessage={credentialCandidatesErrorMessage}
          emptyMessage={t('usersPage.groups.credentialEmpty')}
          searchEmptyMessage={t('usersPage.groups.credentialSearchEmpty')}
          hint={t('usersPage.groups.credentialSelectHint')}
          mutating={mutating}
          onSearchChange={setCredentialSearch}
          onSelectedValuesChange={setSelectedTargetIds}
          onRetry={onRetryCredentialCandidates}
          onClearError={() => setLocalError(null)}
        />
      ) : (
        <BindingCandidateMultiSelect
          title={t('usersPage.groups.model')}
          searchValue={modelSearch}
          searchPlaceholder={t('usersPage.groups.modelSearchPlaceholder')}
          selectedValues={selectedTargetIds}
          selectedCountLabel={t('usersPage.groups.modelSelectedCount', {
            count: selectedTargetIds.length,
          })}
          filteredCountLabel={t('usersPage.groups.modelFilteredCount', {
            count: filteredModelCandidates.length,
          })}
          options={modelOptions}
          pending={modelCandidatesPending}
          issueMessage={modelCandidatesIssueMessage}
          errorMessage={modelCandidatesErrorMessage}
          emptyMessage={t('usersPage.groups.modelCandidateEmpty')}
          searchEmptyMessage={t('usersPage.groups.modelSearchEmpty')}
          hint={t('usersPage.groups.modelSelectHint')}
          filters={modelFilterOptions}
          filterValue={modelSourceFilter}
          mutating={mutating}
          onSearchChange={setModelSearch}
          onSelectedValuesChange={setSelectedTargetIds}
          onFilterChange={(value) => setModelSourceFilter(value as ModelSourceFilter)}
          onRetry={onRetryModelCandidates}
          onClearError={() => setLocalError(null)}
        />
      )}
      {localError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {localError}
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={
            mutating ||
            groups.length === 0 ||
            (kind === 'channel' &&
              (credentialCandidatesPending || Boolean(credentialCandidatesErrorMessage))) ||
            (kind === 'model' && (modelCandidatesPending || Boolean(modelCandidatesErrorMessage)))
          }
        >
          {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('usersPage.actions.addBinding')}
        </Button>
      </div>
    </form>
  )
}

function PeriodLimitWindowCard({ window }: { window: UserPeriodWindowStatus }) {
  const { t } = useTranslation()
  const exhausted = window.enabled && window.remaining !== null && window.remaining <= 0
  const status: UserPeriodWindowVisualStatus = !window.enabled
    ? 'disabled'
    : exhausted
      ? 'exhausted'
      : window.active
        ? 'active'
        : 'notStarted'
  const ratio = window.enabled
    ? window.limit !== null && window.limit > 0
      ? Math.min(window.used / window.limit, 1)
      : 1
    : null
  const percentage = ratio === null ? null : Math.round(ratio * 100)
  const progressClassName =
    status === 'exhausted'
      ? 'bg-destructive'
      : ratio !== null && ratio >= 0.8
        ? 'bg-warning'
        : 'bg-success'
  const windowLabel = t(`usersPage.periodLimits.windows.${window.id}`)
  const windowStart = formatDateTime(window.windowStart)
  const windowEnd = formatDateTime(window.windowEnd)
  const resetAt = formatDateTime(window.resetAt)

  return (
    <div className="grid gap-2 rounded-md border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{windowLabel}</span>
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
            periodWindowStatusClassNames[status],
          )}
        >
          {t(`usersPage.periodLimits.status.${status}`)}
        </span>
      </div>
      {window.enabled ? (
        <>
          {percentage !== null ? (
            <div
              className="bg-muted h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-label={t('usersPage.periodLimits.progressLabel', { window: windowLabel })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
            >
              <div
                className={cn('h-full rounded-full', progressClassName)}
                style={{ width: `${percentage}%` }}
              />
            </div>
          ) : null}
          <p className="text-xs tabular-nums">
            {t('usersPage.periodLimits.usageSummary', {
              used: formatMoney(window.used),
              limit: window.limit !== null ? formatMoney(window.limit) : '—',
              remaining: window.remaining !== null ? formatMoney(window.remaining) : '—',
            })}
          </p>
          <p className="text-muted-foreground text-xs leading-5 break-words">
            {t(`usersPage.periodLimits.modes.${window.mode}`)}
            {window.active && windowStart && windowEnd
              ? ` · ${t('usersPage.periodLimits.windowActive', {
                  start: windowStart,
                  end: windowEnd,
                })}`
              : !window.active && window.mode === 'first_use'
                ? ` · ${t('usersPage.periodLimits.windowNotStarted')}`
                : ''}
            {resetAt ? ` · ${t('usersPage.periodLimits.windowResetsAt', { time: resetAt })}` : ''}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-xs leading-5">
          {t('usersPage.periodLimits.noLimit')}
        </p>
      )}
    </div>
  )
}

function UserDetailContent({
  user,
  accessKeys,
  channelGroups,
  modelGroups,
  periodLimits,
  periodLimitsSupported,
  periodLimitsPending,
  periodLimitsErrorMessage,
  mutating,
  onRetryPeriodLimits,
  onResetPeriodLimits,
}: {
  user: UserResource
  accessKeys: AccessKeyResource[]
  channelGroups: AccessGroupResource[]
  modelGroups: AccessGroupResource[]
  periodLimits: UserPeriodLimitsStatus | null
  periodLimitsSupported: boolean
  periodLimitsPending: boolean
  periodLimitsErrorMessage: string | null
  mutating: boolean
  onRetryPeriodLimits: () => void
  onResetPeriodLimits: () => void
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
            ['credits', formatNumber(user.credits)],
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
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t('usersPage.detail.sections.periodLimits')}</h3>
          {periodLimitsSupported ? (
            <Button
              variant="outline"
              size="sm"
              disabled={mutating || !periodLimits || Boolean(periodLimitsErrorMessage)}
              onClick={onResetPeriodLimits}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {t('usersPage.periodLimits.actions.reset')}
            </Button>
          ) : null}
        </div>
        {!periodLimitsSupported ? (
          <div className="text-muted-foreground rounded-md border border-dashed px-3 py-2.5 text-xs leading-5">
            {t('usersPage.periodLimits.unsupportedDetail')}
          </div>
        ) : periodLimitsErrorMessage ? (
          <div className="border-destructive/30 bg-destructive/10 grid gap-2 rounded-md border px-3 py-2.5">
            <p className="text-destructive text-sm">{t('usersPage.periodLimits.loadError')}</p>
            <p className="text-destructive/80 text-xs break-words">{periodLimitsErrorMessage}</p>
            <div>
              <Button variant="outline" size="sm" onClick={onRetryPeriodLimits}>
                {t('usersPage.actions.retry')}
              </Button>
            </div>
          </div>
        ) : periodLimitsPending && !periodLimits ? (
          <div className="grid gap-2">
            {userPeriodWindowIds.map((id) => (
              <Skeleton key={id} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : periodLimits ? (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="bg-muted text-muted-foreground rounded-md border px-2 py-1 text-xs">
                {t('usersPage.periodLimits.summaryTimezone', {
                  timezone: periodLimits.timezone,
                })}
              </span>
              {periodLimits.creditsUnlimited ? (
                <span className="border-info/25 bg-info/10 text-info rounded-md border px-2 py-1 text-xs font-medium">
                  {t('usersPage.periodLimits.summaryUnlimited')}
                </span>
              ) : null}
            </div>
            {periodLimits.windows.map((window) => (
              <PeriodLimitWindowCard key={window.id} window={window} />
            ))}
          </>
        ) : null}
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

function PeriodResetDialog({
  user,
  status,
  mutating,
  onCancel,
  onConfirm,
}: {
  user: UserResource | null
  status: UserPeriodLimitsStatus | null
  mutating: boolean
  onCancel: () => void
  onConfirm: (input: UserPeriodResetInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<UserPeriodWindowId>>(
    () => new Set(userPeriodWindowIds),
  )
  const [mode, setMode] = useState<UserPeriodResetMode>('counter')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    setSelected(new Set(userPeriodWindowIds))
    setMode('counter')
    setLocalError(null)
  }, [user])

  const toggleWindow = (id: UserPeriodWindowId) => {
    setSelected((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const handleConfirm = async () => {
    if (selected.size === 0) {
      setLocalError(t('usersPage.periodLimits.reset.validation.windowsRequired'))
      return
    }

    try {
      setLocalError(null)
      await onConfirm({
        windows: userPeriodWindowIds.filter((id) => selected.has(id)),
        mode,
      })
    } catch (error) {
      const apiFieldErrors = mapPeriodResetFieldErrors(t, getUserApiFieldErrors(error)).filter(
        (message) => message.length > 0,
      )
      setLocalError(
        apiFieldErrors.length > 0
          ? apiFieldErrors.join(' ')
          : error instanceof Error
            ? error.message
            : String(error),
      )
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('usersPage.periodLimits.reset.title')}</DialogTitle>
          <DialogDescription>
            {t('usersPage.periodLimits.reset.description', { name: user?.username ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium">{t('usersPage.periodLimits.reset.windowsLabel')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {userPeriodWindowIds.map((id) => {
                const windowStatus = status?.windows.find((window) => window.id === id)

                return (
                  <label
                    key={id}
                    className="hover:bg-accent/50 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={selected.has(id)}
                      disabled={mutating}
                      onCheckedChange={() => toggleWindow(id)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {t(`usersPage.periodLimits.windows.${id}`)}
                    </span>
                    {windowStatus?.enabled ? (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {t('usersPage.periodLimits.status.enabledShort')}
                      </span>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">{t('usersPage.periodLimits.reset.modeLabel')}</p>
            <RadioGroup
              value={mode}
              disabled={mutating}
              onValueChange={(value) => setMode(value as UserPeriodResetMode)}
            >
              <label className="hover:bg-accent/50 flex items-start gap-2 rounded-md border px-3 py-2">
                <RadioGroupItem value="counter" className="mt-0.5" disabled={mutating} />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">
                    {t('usersPage.periodLimits.reset.modes.counter')}
                  </span>
                  <span className="text-muted-foreground text-xs leading-5">
                    {t('usersPage.periodLimits.reset.modes.counterHint')}
                  </span>
                </span>
              </label>
              <label className="hover:bg-accent/50 flex items-start gap-2 rounded-md border px-3 py-2">
                <RadioGroupItem value="window_only" className="mt-0.5" disabled={mutating} />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">
                    {t('usersPage.periodLimits.reset.modes.windowOnly')}
                  </span>
                  <span className="text-muted-foreground text-xs leading-5">
                    {t('usersPage.periodLimits.reset.modes.windowOnlyHint')}
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>
          {localError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
              {localError}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={mutating} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button disabled={mutating} onClick={() => void handleConfirm()}>
            {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('usersPage.periodLimits.reset.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UsersTable({
  users,
  accessKeys,
  channelGroups,
  modelGroups,
  selectedUserIds,
  onView,
  onEdit,
  onDelete,
  onToggleSelection,
  onToggleAll,
  onBalanceOperation,
}: {
  users: UserResource[]
  accessKeys: AccessKeyResource[]
  channelGroups: AccessGroupResource[]
  modelGroups: AccessGroupResource[]
  selectedUserIds: Set<string>
  onView: (user: UserResource) => void
  onEdit: (user: UserResource) => void
  onDelete: (user: UserResource) => void
  onToggleSelection: (user: UserResource) => void
  onToggleAll: () => void
  onBalanceOperation: (users: UserResource[]) => void
}) {
  const { t } = useTranslation()
  const selectableUsers = users.filter((user) => toBalanceOperationTarget(user) !== null)
  const allSelected =
    selectableUsers.length > 0 && selectableUsers.every((user) => selectedUserIds.has(user.id))
  const partiallySelected =
    !allSelected && selectableUsers.some((user) => selectedUserIds.has(user.id))

  if (users.length === 0) {
    return <TableEmptyState kind="empty" className="m-0" title={t('usersPage.list.empty')} />
  }

  return (
    <Table
      containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
      className="min-w-[1220px]"
    >
      <TableHeader className={stickyTableHeaderClassName}>
        <TableRow variant="static">
          <TableHead className="w-10">
            <Checkbox
              checked={partiallySelected ? 'indeterminate' : allSelected}
              disabled={selectableUsers.length === 0}
              aria-label={t('usersPage.balance.bulk.selectAll')}
              onCheckedChange={onToggleAll}
            />
          </TableHead>
          <TableHead>{t('usersPage.list.user')}</TableHead>
          <TableHead>{t('usersPage.list.status')}</TableHead>
          <TableHead>{t('usersPage.list.credits')}</TableHead>
          <TableHead className="w-[120px]">{t('usersPage.list.periodLimits')}</TableHead>
          <TableHead>{t('usersPage.list.keys')}</TableHead>
          <TableHead>{t('usersPage.scopes.credential')}</TableHead>
          <TableHead>{t('usersPage.scopes.model')}</TableHead>
          <TableHead>{t('usersPage.list.updatedAt')}</TableHead>
          <TableHead className="table-sticky-action-head w-[280px] text-right">
            {t('usersPage.list.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const keys = getUserKeys(accessKeys, user)
          const credentialScopeIds = getUnion(keys.map((key) => key.channelGroupIds))
          const modelScopeIds = getUnion(keys.map((key) => key.modelGroupIds))
          const balanceTarget = toBalanceOperationTarget(user)
          const balanceDisabled = !balanceTarget

          return (
            <TableRow key={user.id} variant="resource" className="group">
              <TableCell>
                <Checkbox
                  checked={selectedUserIds.has(user.id)}
                  disabled={balanceDisabled}
                  aria-label={t('usersPage.balance.bulk.selectOne', {
                    user: user.username,
                  })}
                  onCheckedChange={() => onToggleSelection(user)}
                  onClick={(event) => event.stopPropagation()}
                />
              </TableCell>
              <TableCell>
                <div className="min-w-0">
                  <p className="font-medium">{user.username}</p>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge deletedAt={user.deletedAt} />
              </TableCell>
              <TableCell>{formatNumber(user.credits)}</TableCell>
              <TableCell className="w-[120px]">
                <UserPeriodLimitsTableBadge summary={user.periodLimitsSummary} />
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
              <TableCell className="table-sticky-action-cell w-[280px] text-right transition-colors">
                <div className="table-action-cell-content">
                  <Button variant="text" size="sm" className="px-2" onClick={() => onView(user)}>
                    <Eye className="size-4" aria-hidden="true" />
                    {t('usersPage.actions.view')}
                  </Button>
                  <Button variant="text" size="sm" className="px-2" onClick={() => onEdit(user)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    {t('usersPage.actions.edit')}
                  </Button>
                  <Button
                    variant="text"
                    size="sm"
                    className="px-2"
                    disabled={balanceDisabled}
                    onClick={() => onBalanceOperation([user])}
                  >
                    <CircleDollarSign className="size-4" aria-hidden="true" />
                    {t('usersPage.balance.actions.balance')}
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
    return <TableEmptyState kind="empty" className="m-0" title={t('usersPage.keys.empty')} />
  }

  return (
    <Table
      containerClassName={cn(containedTableContainerClassName, 'rounded-md border')}
      className="min-w-[920px]"
    >
      <TableHeader className={stickyTableHeaderClassName}>
        <TableRow variant="static">
          <TableHead>{t('usersPage.keys.key')}</TableHead>
          <TableHead>{t('usersPage.keys.owner')}</TableHead>
          <TableHead>{t('usersPage.scopes.credential')}</TableHead>
          <TableHead>{t('usersPage.scopes.model')}</TableHead>
          <TableHead>{t('usersPage.keys.length')}</TableHead>
          <TableHead className="table-sticky-action-head w-[180px] text-right">
            {t('usersPage.list.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key.id} variant="resource" className="group">
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
              {groupListLabel(modelGroups, key.modelGroupIds, t('usersPage.scopes.unrestricted'))}
            </TableCell>
            <TableCell>{key.length}</TableCell>
            <TableCell className="table-sticky-action-cell w-[180px] text-right transition-colors">
              <div className="table-action-cell-content">
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
      <TableEmptyState
        kind="empty"
        className="m-0"
        title={
          kind === 'channel' ? t('usersPage.groups.channelEmpty') : t('usersPage.groups.modelEmpty')
        }
      />
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
                  <TableRow variant="static">
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
                    <TableRow variant="static">
                      <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                        {t('usersPage.groups.noDetails')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupDetails.map((detail) => (
                      <TableRow key={detail.id} variant="resource">
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

function BalanceOperationForm({
  targets,
  mutating,
  onCancel,
  onSubmit,
}: {
  targets: BalanceOperationTarget[]
  mutating: boolean
  onCancel: () => void
  onSubmit: (draft: BalanceOperationDraft) => Promise<void>
}) {
  const { t } = useTranslation()
  const [operation, setOperation] = useState<'recharge' | 'deduct'>('recharge')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    amount?: string
    note?: string
  }>({})
  const parsedAmount = Number(amount)
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0
  const currentTotal = targets.reduce((total, target) => total + target.credits, 0)
  const perTargetDelta = amountIsValid
    ? operation === 'recharge'
      ? parsedAmount
      : -parsedAmount
    : 0
  const totalDelta = amountIsValid ? perTargetDelta * targets.length : null
  const nextTotal = totalDelta !== null ? currentTotal + totalDelta : null
  const negativeTargetCount = amountIsValid
    ? targets.filter((target) => target.credits + perTargetDelta < 0).length
    : 0
  const targetLabel =
    targets.length === 1
      ? formatBalanceTargetIdentity(targets[0])
      : t('usersPage.balance.form.targetCount', { count: targets.length })

  useEffect(() => {
    setOperation('recharge')
    setAmount('')
    setNote('')
    setError(null)
    setFieldErrors({})
  }, [targets])

  const handleOperationChange = (nextOperation: 'recharge' | 'deduct') => {
    setOperation(nextOperation)
    setError(null)
    setFieldErrors({})
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    const nextFieldErrors: typeof fieldErrors = {}

    if (targets.length === 0) {
      setError(t('usersPage.balance.validation.targetRequired'))
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      nextFieldErrors.amount = t('usersPage.balance.validation.amountRequired')
    }
    if (operation === 'deduct' && !note.trim()) {
      nextFieldErrors.note = t('usersPage.balance.validation.noteRequired')
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setError(null)
      return
    }

    setFieldErrors({})
    setError(null)
    try {
      const nextDelta = operation === 'recharge' ? numericAmount : -numericAmount
      await onSubmit({
        operation,
        targets,
        amount: numericAmount,
        note: note.trim(),
        currentTotal,
        nextTotal: currentTotal + nextDelta * targets.length,
        negativeTargetCount: targets.filter((target) => target.credits + nextDelta < 0).length,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
      <DrawerScaffoldBody className="grid gap-4">
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('usersPage.balance.form.target')}</p>
          <div className="bg-muted/25 grid gap-2 rounded-md border px-3 py-2.5 text-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="text-muted-foreground min-w-0 truncate">
                {targets.length === 1
                  ? t('usersPage.balance.confirm.user')
                  : t('usersPage.balance.confirm.users')}
              </span>
              <span className="min-w-0 text-right font-medium">{targetLabel}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="text-muted-foreground min-w-0 truncate">
                {t('usersPage.balance.form.currentTotal')}
              </span>
              <span className="min-w-0 text-right font-medium tabular-nums">
                {formatMoney(currentTotal)}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="text-muted-foreground min-w-0 truncate">
                {t('usersPage.balance.form.afterTotal')}
              </span>
              <span
                className={cn(
                  'min-w-0 text-right font-medium tabular-nums',
                  nextTotal !== null && nextTotal < 0
                    ? 'text-warning-foreground dark:text-warning'
                    : null,
                )}
              >
                {nextTotal !== null ? formatMoney(nextTotal) : t('usersPage.balance.common.na')}
              </span>
            </div>
          </div>
          {targets.length > 1 ? (
            <p className="text-muted-foreground text-xs leading-5">
              {t('usersPage.balance.form.batchHint')}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('usersPage.balance.form.operation')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={operation === 'recharge' ? 'default' : 'outline'}
              disabled={mutating}
              onClick={() => handleOperationChange('recharge')}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('usersPage.balance.actions.recharge')}
            </Button>
            <Button
              type="button"
              variant={operation === 'deduct' ? 'warning' : 'outline'}
              disabled={mutating}
              onClick={() => handleOperationChange('deduct')}
            >
              <Minus className="size-4" aria-hidden="true" />
              {t('usersPage.balance.actions.deduct')}
            </Button>
          </div>
        </div>

        {operation === 'deduct' && negativeTargetCount > 0 ? (
          <div className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-3 py-2 text-sm">
            {t('usersPage.balance.form.negativeTargetHint', { count: negativeTargetCount })}
          </div>
        ) : null}

        <label className="grid gap-2 text-sm font-medium">
          <span>{t('usersPage.balance.form.amount')}</span>
          <Input
            type="number"
            min="0"
            step="0.000001"
            value={amount}
            aria-label={t('usersPage.balance.form.amount')}
            aria-invalid={Boolean(fieldErrors.amount)}
            disabled={mutating}
            onChange={(event) => {
              setAmount(event.target.value)
              setFieldErrors((current) => ({ ...current, amount: undefined }))
            }}
          />
          <span className="text-muted-foreground text-xs leading-5">
            {targets.length > 1
              ? t('usersPage.balance.form.amountBatchHint')
              : t('usersPage.balance.form.amountSingleHint')}
          </span>
          {fieldErrors.amount ? (
            <span className="text-destructive text-xs leading-5 font-normal">
              {fieldErrors.amount}
            </span>
          ) : null}
        </label>

        <label className="grid gap-2 text-sm font-medium">
          <span>
            {operation === 'deduct'
              ? t('usersPage.balance.form.noteRequired')
              : t('usersPage.balance.form.note')}
          </span>
          <Textarea
            value={note}
            className="min-h-20"
            aria-label={
              operation === 'deduct'
                ? t('usersPage.balance.form.noteRequired')
                : t('usersPage.balance.form.note')
            }
            aria-invalid={Boolean(fieldErrors.note)}
            disabled={mutating}
            onChange={(event) => {
              setNote(event.target.value)
              setFieldErrors((current) => ({ ...current, note: undefined }))
            }}
          />
          {fieldErrors.note ? (
            <span className="text-destructive text-xs leading-5 font-normal">
              {fieldErrors.note}
            </span>
          ) : null}
        </label>

        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}
      </DrawerScaffoldBody>
      <DrawerScaffoldFooter>
        <Button type="button" variant="outline" disabled={mutating} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant={operation === 'deduct' ? 'warning' : 'default'}
          disabled={mutating || targets.length === 0}
        >
          {mutating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : operation === 'deduct' ? (
            <Minus className="size-4" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {operation === 'recharge'
            ? t('usersPage.balance.actions.recharge')
            : t('usersPage.balance.actions.deduct')}
        </Button>
      </DrawerScaffoldFooter>
    </form>
  )
}

export function UsersWorkbenchPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<UsersAccessTab>('users')
  const [search, setSearch] = useState('')
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set())
  const [pendingBalanceOperation, setPendingBalanceOperation] =
    useState<PendingBalanceOperation | null>(null)
  const [pendingPeriodReset, setPendingPeriodReset] = useState<UserResource | null>(null)
  const loadCredentialCandidates =
    sheetMode?.type === 'detail-create' && sheetMode.kind === 'channel'
  const loadModelCandidates = sheetMode?.type === 'detail-create' && sheetMode.kind === 'model'
  const loadPeriodLimits = sheetMode?.type === 'user-detail'
  const selectedUserId =
    sheetMode?.type === 'user-detail' || sheetMode?.type === 'user-edit' ? sheetMode.user.id : null
  const workbench = useUserWorkbench(
    selectedUserId,
    loadCredentialCandidates,
    loadModelCandidates,
    loadPeriodLimits,
  )

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
  const selectedUsers = useMemo(
    () => users.filter((user) => selectedUserIds.has(user.id) && toBalanceOperationTarget(user)),
    [selectedUserIds, users],
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
  const assignedKeyCount = accessKeys.filter((key) => key.userId !== null).length
  const unassignedKeyCount = Math.max(accessKeys.length - assignedKeyCount, 0)

  useEffect(() => {
    if (activeTab === 'users') return

    setSelectedUserIds((current) => (current.size > 0 ? new Set() : current))
  }, [activeTab])

  useEffect(() => {
    const eligibleIds = new Set(
      users.filter((user) => toBalanceOperationTarget(user) !== null).map((user) => user.id),
    )

    setSelectedUserIds((current) => {
      const next = new Set([...current].filter((id) => eligibleIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [users])

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return <UsersLoadingState />
  }
  if (!workbench.connected) return <UsersDisconnectedState />
  if (!workbench.capabilities.users) {
    return <UsersUnsupportedState runtimeLabel={t(`runtimeMode.${workbench.runtimeMode}`)} />
  }
  if (workbench.isPending) return <UsersLoadingState />
  if (workbench.isError) {
    return <UsersErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
  }

  const closeSheet = () => setSheetMode(null)

  const openBalanceOperation = (targetUsers: UserResource[]) => {
    const targets = targetUsers.map(toBalanceOperationTarget).filter(isBalanceOperationTarget)

    if (targets.length === 0) {
      toast.error(t('usersPage.balance.toast.noEligibleUsers'))
      return
    }

    setSheetMode({ type: 'balance', targets })
  }

  const toggleUserSelection = (user: UserResource) => {
    if (!toBalanceOperationTarget(user)) return

    setSelectedUserIds((current) => {
      const next = new Set(current)

      if (next.has(user.id)) {
        next.delete(user.id)
      } else {
        next.add(user.id)
      }

      return next
    })
  }

  const toggleFilteredUserSelection = () => {
    const selectableUsers = filteredUsers.filter((user) => toBalanceOperationTarget(user) !== null)
    const allFilteredSelected =
      selectableUsers.length > 0 && selectableUsers.every((user) => selectedUserIds.has(user.id))

    setSelectedUserIds((current) => {
      const next = new Set(current)

      for (const user of selectableUsers) {
        if (allFilteredSelected) {
          next.delete(user.id)
        } else {
          next.add(user.id)
        }
      }

      return next
    })
  }

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
          : sheetMode?.type === 'balance'
            ? sheetMode.targets.length > 1
              ? t('usersPage.balance.sheet.batchTitle')
              : t('usersPage.balance.sheet.title')
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
          : sheetMode?.type === 'balance'
            ? sheetMode.targets.length > 1
              ? t('usersPage.balance.sheet.batchDescription')
              : t('usersPage.balance.sheet.description')
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
  const pendingBalanceTargetCount = pendingBalanceOperation?.targets.length ?? 0
  const pendingBalanceTargetLabel =
    pendingBalanceOperation && pendingBalanceTargetCount === 1
      ? formatBalanceTargetIdentity(pendingBalanceOperation.targets[0])
      : pendingBalanceOperation
        ? t('usersPage.balance.form.targetCount', { count: pendingBalanceTargetCount })
        : ''
  const pendingBalanceSignedAmount = pendingBalanceOperation
    ? formatSignedAmount(
        pendingBalanceOperation.operation === 'deduct'
          ? -Math.abs(pendingBalanceOperation.amount)
          : Math.abs(pendingBalanceOperation.amount),
      )
    : ''
  const pendingBalanceTotalChange = pendingBalanceOperation
    ? formatSignedAmount(
        pendingBalanceOperation.operation === 'deduct'
          ? -Math.abs(pendingBalanceOperation.amount * pendingBalanceTargetCount)
          : Math.abs(pendingBalanceOperation.amount * pendingBalanceTargetCount),
      )
    : ''

  return (
    <section className="grid gap-5">
      <PageHeader
        title={t('usersPage.header.title')}
        actions={
          <>
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
          </>
        }
        tags={
          <>
            <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
              {t('usersPage.header.users', { count: users.length })}
            </span>
            {unassignedKeyCount > 0 ? (
              <span className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-2.5 py-1 text-xs font-medium">
                {t('usersPage.header.unassignedKeys', { count: unassignedKeyCount })}
              </span>
            ) : null}
          </>
        }
      />

      <TableSurface className="min-w-0">
        <TableSurfaceHeader
          title={t('usersPage.workspace.title')}
          actions={
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
          }
          actionsClassName="w-full lg:w-auto"
        />
        <Tabs
          value={activeTab}
          className="min-w-0"
          onValueChange={(value) => setActiveTab(value as UsersAccessTab)}
        >
          <div className="px-4 pt-4">
            <TabsList aria-label={t('usersPage.workspace.title')}>
              {(['users', 'keys', 'channelGroups', 'modelGroups'] as UsersAccessTab[]).map(
                (tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {t(`usersPage.tabs.${tab}`)}
                  </TabsTrigger>
                ),
              )}
            </TabsList>
          </div>

          <TabsContent value="users" className="p-4">
            <div className="grid gap-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setSheetMode({ type: 'user-create' })}>
                  <Plus className="size-4" aria-hidden="true" />
                  {t('usersPage.actions.newUser')}
                </Button>
              </div>
              {selectedUsers.length > 0 ? (
                <div className="bg-muted/60 flex flex-col gap-3 rounded-md border px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {t('usersPage.balance.bulk.selected', { count: selectedUsers.length })}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {t('usersPage.balance.bulk.selectedSummary')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="text"
                      size="sm"
                      disabled={workbench.mutating}
                      onClick={() => setSelectedUserIds(new Set())}
                    >
                      {t('usersPage.balance.bulk.clearSelection')}
                    </Button>
                    <Button
                      variant="text"
                      size="sm"
                      disabled={workbench.mutating}
                      onClick={() => openBalanceOperation(selectedUsers)}
                    >
                      <CircleDollarSign className="size-4" aria-hidden="true" />
                      {t('usersPage.balance.bulk.balanceSelected')}
                    </Button>
                  </div>
                </div>
              ) : null}
              <UsersTable
                users={filteredUsers}
                accessKeys={accessKeys}
                channelGroups={channelGroups}
                modelGroups={modelGroups}
                selectedUserIds={selectedUserIds}
                onView={(user) => setSheetMode({ type: 'user-detail', user })}
                onEdit={(user) => setSheetMode({ type: 'user-edit', user })}
                onDelete={(user) => setPendingDelete({ type: 'user', user })}
                onToggleSelection={toggleUserSelection}
                onToggleAll={toggleFilteredUserSelection}
                onBalanceOperation={openBalanceOperation}
              />
            </div>
          </TabsContent>

          <TabsContent value="keys" className="p-4">
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
          </TabsContent>

          <TabsContent value="channelGroups" className="p-4">
            {accessGroupsAvailable ? (
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
            )}
          </TabsContent>

          <TabsContent value="modelGroups" className="p-4">
            {accessGroupsAvailable ? (
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
          </TabsContent>
        </Tabs>
      </TableSurface>

      <Sheet open={Boolean(sheetMode)} onOpenChange={(open) => !open && closeSheet()}>
        <DrawerScaffoldContent className="sm:max-w-xl">
          <DrawerScaffoldHeader>
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>{sheetDescription}</SheetDescription>
          </DrawerScaffoldHeader>
          {sheetMode?.type === 'user-create' || sheetMode?.type === 'user-edit' ? (
            <UserForm
              mode={sheetMode.type === 'user-create' ? 'create' : 'edit'}
              user={sheetMode.type === 'user-edit' ? sheetMode.user : null}
              periodLimitsSupported={workbench.capabilities.userPeriodLimits}
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
              periodLimits={workbench.selectedUserPeriodLimits}
              periodLimitsSupported={workbench.capabilities.userPeriodLimits}
              periodLimitsPending={workbench.isFetchingPeriodLimits}
              periodLimitsErrorMessage={workbench.periodLimitsErrorMessage}
              mutating={workbench.mutating}
              onRetryPeriodLimits={workbench.refetchPeriodLimits}
              onResetPeriodLimits={() =>
                setPendingPeriodReset(workbench.selectedUser ?? sheetMode.user)
              }
            />
          ) : sheetMode?.type === 'balance' ? (
            <BalanceOperationForm
              targets={sheetMode.targets}
              mutating={workbench.mutating}
              onCancel={closeSheet}
              onSubmit={(draft) => {
                setPendingBalanceOperation(draft)
                return Promise.resolve()
              }}
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
              details={sheetMode.kind === 'channel' ? channelGroupDetails : modelGroupDetails}
              credentialCandidates={workbench.credentialCandidates}
              credentialCandidatesPending={workbench.credentialCandidatesPending}
              credentialCandidatesIssueMessage={workbench.credentialCandidatesIssueMessage}
              credentialCandidatesErrorMessage={workbench.credentialCandidatesErrorMessage}
              modelCandidates={workbench.modelCandidates}
              modelCandidatesPending={workbench.modelCandidatesPending}
              modelCandidatesIssueMessage={workbench.modelCandidatesIssueMessage}
              modelCandidatesErrorMessage={workbench.modelCandidatesErrorMessage}
              initialGroupId={sheetMode.groupId}
              mutating={workbench.mutating}
              onCancel={closeSheet}
              onRetryCredentialCandidates={workbench.refetchCredentialCandidates}
              onRetryModelCandidates={workbench.refetchModelCandidates}
              onSubmit={async (input) => {
                if (input.targetIds.length === 1) {
                  await workbench.createGroupDetail({
                    kind: sheetMode.kind,
                    input: {
                      groupId: input.groupId,
                      targetId: input.targetIds[0],
                    },
                  })
                  toast.success(t('usersPage.toast.bindingCreated'))
                  closeSheet()
                  return
                }

                const result = await workbench.createGroupDetails({
                  kind: sheetMode.kind,
                  inputs: input.targetIds.map((targetId) => ({
                    groupId: input.groupId,
                    targetId,
                  })),
                })

                if (result.failed.length > 0) {
                  if (result.createdCount > 0) {
                    toast.warning(
                      t('usersPage.toast.bindingsPartiallyCreated', {
                        created: result.createdCount,
                        failed: result.failed.length,
                      }),
                    )
                  }

                  throw new Error(
                    t('usersPage.form.validation.bindingBatchFailed', {
                      failed: result.failed.length,
                      message: result.failed[0]?.message ?? '',
                    }),
                  )
                }

                toast.success(t('usersPage.toast.bindingsCreated', { count: result.createdCount }))
                closeSheet()
              }}
            />
          ) : null}
        </DrawerScaffoldContent>
      </Sheet>

      <PeriodResetDialog
        user={pendingPeriodReset}
        status={workbench.selectedUserPeriodLimits}
        mutating={workbench.mutating}
        onCancel={() => setPendingPeriodReset(null)}
        onConfirm={async (input) => {
          if (!pendingPeriodReset) return

          await workbench.resetPeriodLimits({ user: pendingPeriodReset, input })
          toast.success(t('usersPage.toast.periodLimitsReset'))
          setPendingPeriodReset(null)
        }}
      />

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

      <AlertDialog
        open={Boolean(pendingBalanceOperation)}
        onOpenChange={(open) => {
          if (!open) setPendingBalanceOperation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingBalanceOperation && pendingBalanceOperation.targets.length > 1
                ? pendingBalanceOperation.operation === 'deduct'
                  ? t('usersPage.balance.confirm.batchDeductTitle')
                  : t('usersPage.balance.confirm.batchRechargeTitle')
                : pendingBalanceOperation?.operation === 'deduct'
                  ? t('usersPage.balance.confirm.deductTitle')
                  : t('usersPage.balance.confirm.rechargeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBalanceOperation && pendingBalanceOperation.targets.length > 1
                ? t('usersPage.balance.confirm.batchDescription')
                : pendingBalanceOperation?.operation === 'deduct'
                  ? t('usersPage.balance.confirm.deductDescription')
                  : t('usersPage.balance.confirm.rechargeDescription')}
            </AlertDialogDescription>
            {pendingBalanceOperation ? (
              <div className="bg-muted/25 grid gap-2 rounded-md border px-3 py-2.5 text-sm">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="text-muted-foreground min-w-0 truncate">
                    {pendingBalanceOperation.targets.length === 1
                      ? t('usersPage.balance.confirm.user')
                      : t('usersPage.balance.confirm.users')}
                  </span>
                  <span className="min-w-0 text-right font-medium">
                    {pendingBalanceTargetLabel}
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="text-muted-foreground min-w-0 truncate">
                    {t('usersPage.balance.confirm.amountPerUser')}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 text-right font-medium tabular-nums',
                      pendingBalanceOperation.operation === 'deduct'
                        ? 'text-warning-foreground dark:text-warning'
                        : 'text-success',
                    )}
                  >
                    {pendingBalanceSignedAmount}
                  </span>
                </div>
                {pendingBalanceOperation.targets.length > 1 ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <span className="text-muted-foreground min-w-0 truncate">
                      {t('usersPage.balance.confirm.totalAmount')}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 text-right font-medium tabular-nums',
                        pendingBalanceOperation.operation === 'deduct'
                          ? 'text-warning-foreground dark:text-warning'
                          : 'text-success',
                      )}
                    >
                      {pendingBalanceTotalChange}
                    </span>
                  </div>
                ) : null}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="text-muted-foreground min-w-0 truncate">
                    {t('usersPage.balance.confirm.currentTotal')}
                  </span>
                  <span className="min-w-0 text-right font-medium tabular-nums">
                    {formatMoney(pendingBalanceOperation.currentTotal)}
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="text-muted-foreground min-w-0 truncate">
                    {t('usersPage.balance.confirm.afterTotal')}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 text-right font-medium tabular-nums',
                      pendingBalanceOperation.nextTotal < 0
                        ? 'text-warning-foreground dark:text-warning'
                        : null,
                    )}
                  >
                    {formatMoney(pendingBalanceOperation.nextTotal)}
                  </span>
                </div>
                <div className="grid gap-1 border-t pt-2">
                  <span className="text-muted-foreground text-xs">
                    {t('usersPage.balance.confirm.note')}
                  </span>
                  <span className="min-w-0 text-sm break-words">
                    {pendingBalanceOperation.note || t('usersPage.balance.common.na')}
                  </span>
                </div>
                {pendingBalanceOperation.negativeTargetCount > 0 ? (
                  <div className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning rounded-md border px-3 py-2 text-xs leading-5">
                    {t('usersPage.balance.confirm.negativeResult', {
                      count: pendingBalanceOperation.negativeTargetCount,
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workbench.mutating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                pendingBalanceOperation?.operation === 'deduct'
                  ? 'bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/20'
                  : undefined
              }
              disabled={workbench.mutating}
              onClick={(event) => {
                event.preventDefault()
                if (!pendingBalanceOperation) return

                const operation = pendingBalanceOperation.operation
                const inputs = pendingBalanceOperation.targets.map((target) => ({
                  userId: target.numericId,
                  amount: pendingBalanceOperation.amount,
                  note: pendingBalanceOperation.note,
                }))
                const action =
                  operation === 'recharge'
                    ? workbench.rechargeBatch(inputs)
                    : workbench.deductBatch(inputs)

                void action
                  .then((result) => {
                    if (result.failed > 0) {
                      toast.error(
                        result.succeeded > 0
                          ? t('usersPage.balance.toast.partialFailed', {
                              succeeded: result.succeeded,
                              failed: result.failed,
                              message: result.firstError ?? '',
                            })
                          : t('usersPage.balance.toast.failed', {
                              count: result.failed,
                              message: result.firstError ?? '',
                            }),
                      )

                      if (result.succeeded === 0) return
                    } else {
                      toast.success(
                        pendingBalanceOperation.targets.length === 1
                          ? operation === 'recharge'
                            ? t('usersPage.toast.recharged')
                            : t('usersPage.toast.deducted')
                          : t('usersPage.balance.toast.batchCompleted', {
                              count: result.succeeded,
                            }),
                      )
                    }

                    setPendingBalanceOperation(null)
                    setSelectedUserIds(new Set())
                    closeSheet()
                  })
                  .catch((mutationError) => {
                    toast.error(
                      mutationError instanceof Error
                        ? mutationError.message
                        : String(mutationError),
                    )
                  })
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('usersPage.balance.confirm.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
