import { useEffect, useMemo, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TableEmptyState } from '@/components/shared/empty-state'
import { fieldClassName } from '@/components/shared/form-layout'
import { PageHeader } from '@/components/shared/page-header'
import { RowActions } from '@/components/shared/row-actions'
import { useSecondaryColumns } from '@/components/shared/table-columns'
import {
  TableSurface,
  TableSurfaceContent,
  TableSurfaceHeader,
  tableHeaderClassName,
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
import { Input } from '@/components/ui/input'
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
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAccessKeyWorkbench } from '@/features/access-keys/use-access-key-workbench'
import type { AccessGroupResource } from '@/lib/api/management/access-groups'
import {
  ACCESS_KEY_DISPLAY_NAME_MAX_LENGTH,
  type AccessKeyResource,
  type AccessKeysSnapshot,
} from '@/lib/api/management/access-keys'
import type { UserResource } from '@/lib/api/management/users'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type DetailMode = 'detail' | 'edit' | 'create'
type AccessKeyFormValues = { value: string; displayName?: string | null }
type PendingAccessKeyConfirmation =
  | { type: 'replace'; values: string[]; snapshot: AccessKeysSnapshot }
  | { type: 'delete'; resource: AccessKeyResource }
  | { type: 'bulkDelete'; resources: AccessKeyResource[] }

function generateAccessKey() {
  const bytes = new Uint8Array(24)
  window.crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return `sk-${token}`
}

function formatAccessKeySequence(resource: AccessKeyResource) {
  return `#${resource.index + 1}`
}

function formatAccessKeyIdentity(resource: AccessKeyResource) {
  const identity = resource.identifier
    ? `${resource.identifier} · ${resource.maskedValue}`
    : resource.maskedValue

  return resource.displayName ? `${resource.displayName} · ${identity}` : identity
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

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value)
}

function AccessKeysDisconnectedState() {
  const { t } = useTranslation()
  const openConnectionDialog = useConsoleUiStore((state) => state.openConnectionDialog)

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-4">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">
                {t('accessKeysPage.disconnected.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {t('accessKeysPage.disconnected.description')}
              </p>
            </div>
          </div>
          <Button className="md:shrink-0" onClick={openConnectionDialog}>
            <KeyRound className="size-4" aria-hidden="true" />
            {t('accessKeysPage.disconnected.action')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function AccessKeysLoadingState() {
  const { t } = useTranslation()

  return (
    <section className="grid gap-5">
      <PageHeader
        title={t('accessKeysPage.loading.title')}
        description={t('accessKeysPage.loading.description')}
        tags={<Skeleton className="h-7 w-32 rounded-md" />}
      />
      <TableSurface>
        <TableSurfaceHeader
          title={t('accessKeysPage.list.title')}
          description={t('accessKeysPage.list.description')}
          actions={
            <>
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md sm:w-72" />
            </>
          }
          actionsClassName="w-full flex-col sm:w-auto sm:flex-row sm:items-center"
        />
        <TableSurfaceContent className="grid gap-3">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
        </TableSurfaceContent>
      </TableSurface>
    </section>
  )
}

function AccessKeysErrorState({
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
                {t('accessKeysPage.error.title')}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {errorMessage ?? t('accessKeysPage.error.description')}
              </p>
            </div>
          </div>
          <Button variant="outline" className="md:shrink-0" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('accessKeysPage.error.retry')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function AccessKeyList({
  resources,
  users,
  channelGroups,
  modelGroups,
  selectedKeyId,
  selectedKeyIds,
  onSelectKey,
  onEditKey,
  onDeleteKey,
  onToggleSelection,
  onToggleAll,
  onCopy,
  onCopyIdentifier,
}: {
  resources: AccessKeyResource[]
  users: UserResource[]
  channelGroups: AccessGroupResource[]
  modelGroups: AccessGroupResource[]
  selectedKeyId: string | null
  selectedKeyIds: Set<string>
  onSelectKey: (resource: AccessKeyResource) => void
  onEditKey: (resource: AccessKeyResource) => void
  onDeleteKey: (resource: AccessKeyResource) => void
  onToggleSelection: (resource: AccessKeyResource) => void
  onToggleAll: () => void
  onCopy: (resource: AccessKeyResource) => void
  onCopyIdentifier: (resource: AccessKeyResource) => void
}) {
  const { t } = useTranslation()
  /*
   * Nine columns is four screens of sideways dragging on a phone. Identity and
   * status stay because they are what a list is for; owner, both scopes, the
   * sequence number and the length are all in the detail sheet the eye opens.
   */
  const showSecondary = useSecondaryColumns()
  const allSelected =
    resources.length > 0 && resources.every((resource) => selectedKeyIds.has(resource.id))
  const partiallySelected =
    !allSelected && resources.some((resource) => selectedKeyIds.has(resource.id))

  if (resources.length === 0) {
    return <TableEmptyState kind="empty" className="m-0" title={t('accessKeysPage.list.empty')} />
  }

  return (
    // Below 40rem: no min-width floor, and fixed layout. Dropping the floor alone
    // is not enough — an auto-layout table ignores a cell's max-width and sizes the
    // column to its content, which kept this one 298px wider than the viewport.
    <Table
      containerClassName="rounded-md border"
      className={cn(!showSecondary && 'table-fixed', 'sm:min-w-[952px]')}
    >
      <TableHeader className={tableHeaderClassName}>
        <TableRow variant="static">
          <TableHead className="w-10">
            <Checkbox
              checked={partiallySelected ? 'indeterminate' : allSelected}
              aria-label={t('accessKeysPage.bulk.selectAll')}
              onCheckedChange={onToggleAll}
            />
          </TableHead>
          {showSecondary ? (
            <TableHead className="w-16">{t('accessKeysPage.list.index')}</TableHead>
          ) : null}
          <TableHead className={showSecondary ? 'w-[220px]' : undefined}>
            <div className="flex items-center gap-1.5">
              <span>{t('accessKeysPage.list.identity')}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="text"
                    size="icon-md"
                    className="text-muted-foreground hover:text-foreground -my-1"
                    aria-label={t('accessKeysPage.list.identifierTooltip')}
                  >
                    <Info className="size-3.5" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  {t('accessKeysPage.list.identifierTooltip')}
                </TooltipContent>
              </Tooltip>
            </div>
          </TableHead>
          {showSecondary ? (
            <>
              <TableHead>{t('accessKeysPage.list.owner')}</TableHead>
              <TableHead>{t('accessKeysPage.list.credentialScope')}</TableHead>
              <TableHead>{t('accessKeysPage.list.modelScope')}</TableHead>
              <TableHead>{t('accessKeysPage.list.length')}</TableHead>
            </>
          ) : null}
          <TableHead className={showSecondary ? undefined : 'w-28'}>
            {t('accessKeysPage.list.status')}
          </TableHead>
          <TableHead className="table-sticky-action-head table-action-column-3 text-right">
            {t('accessKeysPage.list.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => (
          <TableRow
            key={resource.id}
            className={cn('group', selectedKeyId === resource.id ? 'bg-primary/8' : null)}
            variant="resource"
          >
            <TableCell>
              <Checkbox
                checked={selectedKeyIds.has(resource.id)}
                aria-label={t('accessKeysPage.bulk.selectOne', {
                  key: formatAccessKeyIdentity(resource),
                })}
                onCheckedChange={() => onToggleSelection(resource)}
                onClick={(event) => event.stopPropagation()}
              />
            </TableCell>
            {showSecondary ? (
              <TableCell className="text-muted-foreground font-mono text-xs">
                {formatAccessKeySequence(resource)}
              </TableCell>
            ) : null}
            <TableCell className={showSecondary ? 'w-[220px] max-w-[220px]' : 'max-w-0'}>
              {resource.displayName ? (
                <p className="truncate text-sm font-medium">{resource.displayName}</p>
              ) : null}
              {resource.identifier ? (
                <p className="truncate font-mono text-xs font-medium">{resource.identifier}</p>
              ) : (
                <p className="text-muted-foreground truncate text-xs">
                  {t('accessKeysPage.list.identifierUnavailable')}
                </p>
              )}
              {/*
                The copy button sits on the masked value and copies the full
                key string: pasting the key into a client is the frequent
                intent, and a button beside the identifier reads as copying
                the key while yielding a string that fails authentication.
              */}
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <p className="text-muted-foreground min-w-0 truncate font-mono text-xs">
                  {resource.maskedValue}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-md"
                  className="-my-1"
                  aria-label={t('accessKeysPage.actions.copyKey', { key: resource.maskedValue })}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCopy(resource)
                  }}
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </TableCell>
            {showSecondary ? (
              <>
                <TableCell>
                  {userLabel(users, resource.userId) ?? (
                    <span className="text-muted-foreground">
                      {t('accessKeysPage.list.unassigned')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-[220px] truncate">
                  {groupListLabel(
                    channelGroups,
                    resource.channelGroupIds,
                    t('accessKeysPage.list.unrestricted'),
                  )}
                </TableCell>
                <TableCell className="max-w-[220px] truncate">
                  {groupListLabel(
                    modelGroups,
                    resource.modelGroupIds,
                    t('accessKeysPage.list.unrestricted'),
                  )}
                </TableCell>
                <TableCell>{resource.length}</TableCell>
              </>
            ) : null}
            <TableCell>
              <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                {t('accessKeysPage.status.accepted')}
              </span>
            </TableCell>
            <TableCell className="table-sticky-action-cell table-action-column-3 text-right transition-colors">
              {/*
                Two inline slots, so the order below is a ranking and not a
                list. View and edit lead because this row is their only entry
                point. Copying the key value lives beside the masked value it
                copies, so the menu only keeps the low-frequency identifier
                copy for cross-referencing usage and billing records, with
                delete last and one deliberate step away.
              */}
              <RowActions
                menuLabel={formatAccessKeyIdentity(resource)}
                actions={[
                  {
                    id: 'view',
                    label: t('accessKeysPage.actions.view'),
                    icon: Eye,
                    onSelect: () => onSelectKey(resource),
                  },
                  {
                    id: 'edit',
                    label: t('accessKeysPage.actions.edit'),
                    icon: Pencil,
                    onSelect: () => onEditKey(resource),
                  },
                  ...(resource.identifier
                    ? [
                        {
                          id: 'copy-identifier',
                          label: t('accessKeysPage.actions.copyIdentifier'),
                          icon: Copy,
                          onSelect: () => onCopyIdentifier(resource),
                        },
                      ]
                    : []),
                  {
                    id: 'delete',
                    label: t('accessKeysPage.actions.delete'),
                    icon: Trash2,
                    tone: 'destructive' as const,
                    onSelect: () => onDeleteKey(resource),
                  },
                ]}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AccessKeyDetailContent({
  mode,
  resource,
  users,
  channelGroups,
  modelGroups,
  supportsDisplayNames,
  mutating,
  onModeChange,
  onCancel,
  onCreate,
  onUpdate,
  onDelete,
  onCopy,
}: {
  mode: DetailMode
  resource: AccessKeyResource | null
  users: UserResource[]
  channelGroups: AccessGroupResource[]
  modelGroups: AccessGroupResource[]
  supportsDisplayNames: boolean
  mutating: boolean
  onModeChange: (mode: DetailMode) => void
  onCancel: () => void
  onCreate: (input: AccessKeyFormValues) => Promise<void>
  onUpdate: (input: AccessKeyFormValues) => Promise<void>
  onDelete: () => void
  onCopy: (resource: AccessKeyResource) => Promise<void>
}) {
  const { t } = useTranslation()
  const [showSecret, setShowSecret] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [displayNameValue, setDisplayNameValue] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ keyValue?: string; displayName?: string }>({})

  useEffect(() => {
    setShowSecret(false)
    setLocalError(null)
    setFieldErrors({})
    setKeyValue(mode === 'edit' && resource ? resource.value : '')
    setDisplayNameValue(mode === 'edit' && resource ? (resource.displayName ?? '') : '')
  }, [mode, resource])

  const validateDraft = () => {
    const nextErrors: { keyValue?: string; displayName?: string } = {}
    const trimmed = keyValue.trim()
    if (!trimmed) {
      nextErrors.keyValue = t('accessKeysPage.form.validation.required')
    }

    const trimmedDisplayName = displayNameValue.trim()
    if (
      supportsDisplayNames &&
      Array.from(trimmedDisplayName).length > ACCESS_KEY_DISPLAY_NAME_MAX_LENGTH
    ) {
      nextErrors.displayName = t('accessKeysPage.form.validation.displayNameTooLong', {
        max: ACCESS_KEY_DISPLAY_NAME_MAX_LENGTH,
      })
    }

    return nextErrors
  }

  const handleCreateOrUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateDraft()
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setLocalError(null)
      setTimeout(() => {
        document.querySelector<HTMLElement>('#access-key-form [aria-invalid="true"]')?.focus()
      }, 0)
      return
    }

    const trimmed = keyValue.trim()
    const trimmedDisplayName = displayNameValue.trim()

    try {
      setLocalError(null)
      setFieldErrors({})
      const input: AccessKeyFormValues = {
        value: trimmed,
        displayName: supportsDisplayNames ? trimmedDisplayName || null : undefined,
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

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="p-5">
        <form
          id="access-key-form"
          noValidate
          className="grid gap-4"
          onSubmit={(event) => void handleCreateOrUpdate(event)}
        >
          {supportsDisplayNames ? (
            <label className={fieldClassName}>
              <span>{t('accessKeysPage.form.displayName')}</span>
              <Input
                value={displayNameValue}
                disabled={mutating}
                aria-invalid={Boolean(fieldErrors.displayName)}
                placeholder={t('accessKeysPage.form.displayNamePlaceholder')}
                onChange={(event) => {
                  setLocalError(null)
                  setFieldErrors((current) => ({ ...current, displayName: undefined }))
                  setDisplayNameValue(event.target.value)
                }}
                onBlur={() => {
                  const trimmed = displayNameValue.trim()
                  if (
                    supportsDisplayNames &&
                    Array.from(trimmed).length > ACCESS_KEY_DISPLAY_NAME_MAX_LENGTH
                  ) {
                    setFieldErrors((current) => ({
                      ...current,
                      displayName: t('accessKeysPage.form.validation.displayNameTooLong', {
                        max: ACCESS_KEY_DISPLAY_NAME_MAX_LENGTH,
                      }),
                    }))
                  }
                }}
              />
              {fieldErrors.displayName ? (
                <span className="text-destructive text-xs leading-5 font-normal">
                  {fieldErrors.displayName}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t('accessKeysPage.form.displayNameHint', {
                    max: ACCESS_KEY_DISPLAY_NAME_MAX_LENGTH,
                  })}
                </span>
              )}
            </label>
          ) : null}
          <label className={fieldClassName}>
            <span>{t('accessKeysPage.form.keyValue')}</span>
            <div className="flex gap-2">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={keyValue}
                disabled={mutating}
                aria-invalid={Boolean(fieldErrors.keyValue)}
                placeholder="sk-..."
                onChange={(event) => {
                  setLocalError(null)
                  setFieldErrors((current) => ({ ...current, keyValue: undefined }))
                  setKeyValue(event.target.value)
                }}
                onBlur={() => {
                  if (!keyValue.trim()) {
                    setFieldErrors((current) => ({
                      ...current,
                      keyValue: t('accessKeysPage.form.validation.required'),
                    }))
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label={
                  showSecret ? t('accessKeysPage.actions.hide') : t('accessKeysPage.actions.reveal')
                }
                onClick={() => setShowSecret((current) => !current)}
              >
                {showSecret ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            {fieldErrors.keyValue ? (
              <span className="text-destructive text-xs leading-5 font-normal">
                {fieldErrors.keyValue}
              </span>
            ) : null}
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={mutating}
            onClick={() => {
              setLocalError(null)
              setFieldErrors((current) => ({ ...current, keyValue: undefined }))
              setKeyValue(generateAccessKey())
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t('accessKeysPage.actions.generate')}
          </Button>

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
              {mode === 'create'
                ? t('accessKeysPage.actions.create')
                : t('accessKeysPage.actions.save')}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="p-5 text-sm">
        <div className="bg-muted/60 text-muted-foreground flex min-h-48 items-center justify-center rounded-md border px-4 text-center">
          {t('accessKeysPage.detail.empty')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="rounded-md border p-3">
        <p className="text-muted-foreground text-xs">{t('accessKeysPage.detail.secret')}</p>
        <p className="mt-2 font-mono text-sm break-all">
          {showSecret ? resource.value : resource.maskedValue}
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="md" variant="outline" onClick={() => setShowSecret((current) => !current)}>
            {showSecret ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
            {showSecret ? t('accessKeysPage.actions.hide') : t('accessKeysPage.actions.reveal')}
          </Button>
          <Button
            size="md"
            variant="outline"
            onClick={() => {
              void onCopy(resource)
            }}
          >
            <Copy className="size-4" aria-hidden="true" />
            {t('accessKeysPage.actions.copy')}
          </Button>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 text-sm">
        {[
          ...(supportsDisplayNames
            ? [['name', resource.displayName ?? t('accessKeysPage.detail.noName')]]
            : []),
          ['owner', userLabel(users, resource.userId) ?? t('accessKeysPage.list.unassigned')],
          [
            'credentialScope',
            groupListLabel(
              channelGroups,
              resource.channelGroupIds,
              t('accessKeysPage.list.unrestricted'),
            ),
          ],
          [
            'modelScope',
            groupListLabel(
              modelGroups,
              resource.modelGroupIds,
              t('accessKeysPage.list.unrestricted'),
            ),
          ],
        ].map(([key, value]) => (
          <div key={key} className="rounded-md border px-3 py-2.5">
            <dt className="text-muted-foreground text-xs">
              {t(`accessKeysPage.detail.fields.${key}`)}
            </dt>
            <dd className="mt-1 font-mono text-xs break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-2">
        <Button onClick={() => onModeChange('edit')}>
          <Pencil className="size-4" aria-hidden="true" />
          {t('accessKeysPage.actions.edit')}
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={mutating}
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t('accessKeysPage.actions.delete')}
        </Button>
      </div>
    </div>
  )
}

function ReplaceAccessKeysContent({
  resources,
  mutating,
  onCancel,
  onReplace,
}: {
  resources: AccessKeyResource[]
  mutating: boolean
  onCancel: () => void
  onReplace: (values: string[]) => void
}) {
  const { t } = useTranslation()
  const [replacementValue, setReplacementValue] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setLocalError(null)
    setReplacementValue(resources.map((item) => item.value).join('\n'))
  }, [resources])

  const handleReplace = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = replacementValue
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    try {
      setLocalError(null)
      onReplace(values)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="p-5">
      <div className="border-warning/35 bg-warning/12 text-warning-foreground dark:text-warning flex gap-3 rounded-md border px-3 py-2.5 text-sm leading-6">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t('accessKeysPage.replace.warning')}</span>
      </div>
      <form noValidate className="mt-5 grid gap-4" onSubmit={handleReplace}>
        <label className={fieldClassName}>
          <span>{t('accessKeysPage.replace.textarea')}</span>
          <Textarea
            className="min-h-72 font-mono text-xs"
            value={replacementValue}
            disabled={mutating}
            onChange={(event) => setReplacementValue(event.target.value)}
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
          <Button type="submit" variant="warning" disabled={mutating}>
            {mutating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            <Save className="size-4" aria-hidden="true" />
            {t('accessKeysPage.actions.replace')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function AccessKeysWorkbenchPage() {
  const { t } = useTranslation()
  const workbench = useAccessKeyWorkbench()
  const [search, setSearch] = useState('')
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(() => new Set())
  const [detailMode, setDetailMode] = useState<DetailMode>('detail')
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [replaceSheetOpen, setReplaceSheetOpen] = useState(false)
  const [replaceSnapshot, setReplaceSnapshot] = useState<AccessKeysSnapshot | null>(null)
  const [confirmation, setConfirmation] = useState<PendingAccessKeyConfirmation | null>(null)

  const resources = workbench.snapshot?.resources ?? []
  const users = workbench.users
  const channelGroups = workbench.groups?.channelGroups ?? []
  const modelGroups = workbench.groups?.modelGroups ?? []
  const filteredResources = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return resources

    return resources.filter((resource) =>
      [
        resource.value,
        resource.maskedValue,
        resource.identifier ?? '',
        resource.displayName ?? '',
        resource.prefix,
        resource.suffix,
        String(resource.index),
        userLabel(users, resource.userId) ?? '',
        groupListLabel(channelGroups, resource.channelGroupIds, ''),
        groupListLabel(modelGroups, resource.modelGroupIds, ''),
      ].some((value) => value.toLowerCase().includes(normalizedSearch)),
    )
  }, [channelGroups, modelGroups, resources, search, users])
  const selectedResource =
    filteredResources.find((resource) => resource.id === selectedKeyId) ??
    resources.find((resource) => resource.id === selectedKeyId) ??
    null

  useEffect(() => {
    if (selectedKeyId && !resources.some((resource) => resource.id === selectedKeyId)) {
      setSelectedKeyId(null)
      setDetailMode('detail')
      setDetailSheetOpen(false)
    }
  }, [resources, selectedKeyId])

  useEffect(() => {
    const resourceIds = new Set(resources.map((resource) => resource.id))
    setSelectedKeyIds((current) => {
      const nextSelection = new Set(
        Array.from(current).filter((resourceId) => resourceIds.has(resourceId)),
      )

      return nextSelection.size === current.size ? current : nextSelection
    })
  }, [resources])

  if (workbench.checking || (workbench.connected && !workbench.capabilityReady)) {
    return <AccessKeysLoadingState />
  }

  if (!workbench.connected) {
    return <AccessKeysDisconnectedState />
  }

  if (workbench.isPending) {
    return <AccessKeysLoadingState />
  }

  if (workbench.isError || !workbench.snapshot) {
    return (
      <AccessKeysErrorState errorMessage={workbench.errorMessage} onRetry={workbench.refetch} />
    )
  }

  const handleCopy = async (resource: AccessKeyResource) => {
    try {
      await copyToClipboard(resource.value)
      toast.success(t('accessKeysPage.toast.copied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleCopyIdentifier = async (resource: AccessKeyResource) => {
    if (!resource.identifier) return
    try {
      await copyToClipboard(resource.identifier)
      toast.success(t('accessKeysPage.toast.identifierCopied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleCreate = async ({ value, displayName }: AccessKeyFormValues) => {
    await workbench.createKey({ value, displayName })
    toast.success(t('accessKeysPage.toast.created'))
    setDetailMode('detail')
    setSelectedKeyId(null)
    setDetailSheetOpen(false)
  }

  const handleUpdate = async ({ value, displayName }: AccessKeyFormValues) => {
    if (!selectedResource) return
    const valueChanged = value !== selectedResource.value
    const displayNameChanged =
      displayName !== undefined && displayName !== selectedResource.displayName
    if (!valueChanged && !displayNameChanged) {
      setDetailMode('detail')
      return
    }
    await workbench.updateKey({
      resource: selectedResource,
      input: {
        ...(valueChanged ? { value } : {}),
        ...(displayNameChanged ? { displayName } : {}),
      },
    })
    toast.success(t('accessKeysPage.toast.updated'))
    setDetailMode('detail')
  }

  const handleReplace = (values: string[]) => {
    const snapshot = replaceSnapshot
    if (!snapshot) return
    setConfirmation({ type: 'replace', values, snapshot })
  }

  const handleDelete = (resource = selectedResource) => {
    if (!resource) return
    setConfirmation({ type: 'delete', resource })
  }

  const handleToggleSelection = (resource: AccessKeyResource) => {
    setSelectedKeyIds((current) => {
      const nextSelection = new Set(current)

      if (nextSelection.has(resource.id)) {
        nextSelection.delete(resource.id)
      } else {
        nextSelection.add(resource.id)
      }

      return nextSelection
    })
  }

  const handleToggleAll = () => {
    setSelectedKeyIds((current) => {
      const everyFilteredKeySelected = filteredResources.every((resource) =>
        current.has(resource.id),
      )
      const nextSelection = new Set(current)

      for (const resource of filteredResources) {
        if (everyFilteredKeySelected) {
          nextSelection.delete(resource.id)
        } else {
          nextSelection.add(resource.id)
        }
      }

      return nextSelection
    })
  }

  const handleBulkDelete = () => {
    const selectedResources = resources.filter((resource) => selectedKeyIds.has(resource.id))
    if (selectedResources.length === 0) return

    setConfirmation({ type: 'bulkDelete', resources: selectedResources })
  }

  const handleConfirmAction = async () => {
    const currentConfirmation = confirmation
    if (!currentConfirmation) return

    try {
      if (currentConfirmation.type === 'replace') {
        await workbench.replaceKeys({
          values: currentConfirmation.values,
          snapshot: currentConfirmation.snapshot,
        })
        toast.success(t('accessKeysPage.toast.replaced'))
        setSelectedKeyId(null)
        setDetailMode('detail')
        setReplaceSheetOpen(false)
        setReplaceSnapshot(null)
        setDetailSheetOpen(false)
        setConfirmation(null)
        return
      }

      if (currentConfirmation.type === 'delete') {
        await workbench.deleteKey(currentConfirmation.resource)
        toast.success(t('accessKeysPage.toast.deleted'))
        if (selectedKeyId === currentConfirmation.resource.id) {
          setSelectedKeyId(null)
          setDetailSheetOpen(false)
        }
        setDetailMode('detail')
        setConfirmation(null)
        return
      }

      await workbench.bulkDeleteKeys(currentConfirmation.resources)
      toast.success(
        t('accessKeysPage.toast.bulkDeleted', { count: currentConfirmation.resources.length }),
      )
      setSelectedKeyIds(new Set())
      setSelectedKeyId(null)
      setDetailMode('detail')
      setDetailSheetOpen(false)
      setConfirmation(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const detailSheetTitle =
    detailMode === 'create'
      ? t('accessKeysPage.form.createTitle')
      : detailMode === 'edit'
        ? t('accessKeysPage.form.editTitle')
        : t('accessKeysPage.detail.title')

  const detailSheetDescription =
    detailMode === 'create'
      ? t('accessKeysPage.form.createEyebrow')
      : selectedResource
        ? formatAccessKeyIdentity(selectedResource)
        : t('accessKeysPage.detail.empty')

  const confirmationCopy =
    confirmation?.type === 'replace'
      ? {
          title: t('accessKeysPage.replace.title'),
          description: t('accessKeysPage.replace.confirm'),
          action: t('accessKeysPage.actions.replace'),
        }
      : confirmation?.type === 'delete'
        ? {
            title: t('accessKeysPage.delete.title'),
            description: t('accessKeysPage.delete.confirm', {
              key: formatAccessKeyIdentity(confirmation.resource),
            }),
            action: t('accessKeysPage.actions.delete'),
          }
        : confirmation?.type === 'bulkDelete'
          ? {
              title: t('accessKeysPage.bulk.deleteTitle'),
              description: t('accessKeysPage.bulk.deleteConfirm', {
                count: confirmation.resources.length,
              }),
              action: t('accessKeysPage.bulk.deleteSelected'),
            }
          : null

  return (
    <section className="grid w-full gap-5">
      <PageHeader
        title={t('accessKeysPage.header.title')}
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              disabled={workbench.isFetching}
              onClick={workbench.refetch}
              aria-label={
                workbench.isFetching
                  ? t('accessKeysPage.actions.syncing')
                  : t('accessKeysPage.actions.refresh')
              }
              title={
                workbench.isFetching
                  ? t('accessKeysPage.actions.syncing')
                  : t('accessKeysPage.actions.refresh')
              }
            >
              {workbench.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {workbench.isFetching
                ? t('accessKeysPage.actions.syncing')
                : t('accessKeysPage.actions.refresh')}
            </Button>
            <Button
              size="md"
              onClick={() => {
                setSelectedKeyId(null)
                setDetailMode('create')
                setDetailSheetOpen(true)
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('accessKeysPage.actions.new')}
            </Button>
          </>
        }
        tags={
          <>
            <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
              {t('accessKeysPage.header.total', { count: resources.length })}
            </span>
          </>
        }
      />

      <TableSurface className="min-w-0">
        <TableSurfaceHeader
          title={t('accessKeysPage.list.title')}
          description={t('accessKeysPage.list.description')}
          actions={
            <>
              <Button
                variant="outline"
                size="md"
                disabled={workbench.mutating}
                onClick={() => {
                  setReplaceSnapshot(workbench.snapshot ?? null)
                  setReplaceSheetOpen(true)
                }}
              >
                <Save className="size-4" aria-hidden="true" />
                {t('accessKeysPage.actions.replace')}
              </Button>
              <div className="relative min-w-0 sm:w-72">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  size="md"
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('accessKeysPage.list.filterPlaceholder')}
                />
              </div>
            </>
          }
          actionsClassName="w-full flex-col sm:w-auto sm:flex-row sm:items-center"
        />
        <TableSurfaceContent>
          {selectedKeyIds.size > 0 ? (
            <div className="bg-muted/60 mb-3 flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">
                {t('accessKeysPage.bulk.selected', { count: selectedKeyIds.size })}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="text"
                  size="md"
                  disabled={workbench.mutating}
                  onClick={() => setSelectedKeyIds(new Set())}
                >
                  {t('accessKeysPage.bulk.clearSelection')}
                </Button>
                <Button
                  variant="destructiveText"
                  size="md"
                  disabled={workbench.mutating}
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t('accessKeysPage.bulk.deleteSelected')}
                </Button>
              </div>
            </div>
          ) : null}
          <AccessKeyList
            resources={filteredResources}
            users={users}
            channelGroups={channelGroups}
            modelGroups={modelGroups}
            selectedKeyId={selectedKeyId}
            selectedKeyIds={selectedKeyIds}
            onSelectKey={(resource) => {
              setSelectedKeyId(resource.id)
              setDetailMode('detail')
              setDetailSheetOpen(true)
            }}
            onEditKey={(resource) => {
              setSelectedKeyId(resource.id)
              setDetailMode('edit')
              setDetailSheetOpen(true)
            }}
            onDeleteKey={(resource) => handleDelete(resource)}
            onToggleSelection={handleToggleSelection}
            onToggleAll={handleToggleAll}
            onCopy={(resource) => {
              void handleCopy(resource)
            }}
            onCopyIdentifier={(resource) => {
              void handleCopyIdentifier(resource)
            }}
          />
        </TableSurfaceContent>
      </TableSurface>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-5">
            <SheetTitle>{detailSheetTitle}</SheetTitle>
            <SheetDescription>{detailSheetDescription}</SheetDescription>
          </SheetHeader>
          <AccessKeyDetailContent
            mode={detailMode}
            resource={selectedResource}
            users={users}
            channelGroups={channelGroups}
            modelGroups={modelGroups}
            supportsDisplayNames={workbench.snapshot?.supportsDisplayNames ?? false}
            mutating={workbench.mutating}
            onModeChange={setDetailMode}
            onCancel={() => {
              if (detailMode === 'edit' && selectedResource) {
                setDetailMode('detail')
                return
              }

              setDetailSheetOpen(false)
            }}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={() => handleDelete(selectedResource)}
            onCopy={handleCopy}
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={replaceSheetOpen}
        onOpenChange={(open) => {
          setReplaceSheetOpen(open)
          if (!open) setReplaceSnapshot(null)
        }}
      >
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-5">
            <SheetTitle>{t('accessKeysPage.replace.title')}</SheetTitle>
            <SheetDescription>{t('accessKeysPage.replace.description')}</SheetDescription>
          </SheetHeader>
          <ReplaceAccessKeysContent
            resources={replaceSnapshot?.resources ?? resources}
            mutating={workbench.mutating}
            onCancel={() => {
              setReplaceSheetOpen(false)
              setReplaceSnapshot(null)
            }}
            onReplace={handleReplace}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !workbench.mutating) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationCopy?.description}</AlertDialogDescription>
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
                void handleConfirmAction()
              }}
            >
              {workbench.mutating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {confirmationCopy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
