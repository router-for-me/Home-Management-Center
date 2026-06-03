import { useEffect, useMemo, useState } from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
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
import { useAccessKeyWorkbench } from '@/features/access-keys/use-access-key-workbench'
import type { AccessGroupResource } from '@/lib/api/management/access-groups'
import type { AccessKeyResource } from '@/lib/api/management/access-keys'
import type { UserResource } from '@/lib/api/management/users'
import { cn } from '@/lib/utils'
import { useConsoleUiStore } from '@/stores/ui-store'

type DetailMode = 'detail' | 'edit' | 'create'
type PendingAccessKeyConfirmation =
  | { type: 'replace'; values: string[] }
  | { type: 'delete'; resource: AccessKeyResource }
  | { type: 'bulkDelete'; resources: AccessKeyResource[] }

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function generateAccessKey() {
  const bytes = new Uint8Array(24)
  window.crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return `sk-${token}`
}

function formatAccessKeySequence(resource: AccessKeyResource) {
  return `#${resource.index + 1}`
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
  return (
    <section className="grid gap-5">
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg" />
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
}) {
  const { t } = useTranslation()
  const allSelected =
    resources.length > 0 && resources.every((resource) => selectedKeyIds.has(resource.id))
  const partiallySelected =
    !allSelected && resources.some((resource) => selectedKeyIds.has(resource.id))

  if (resources.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border px-4 py-10 text-center text-sm">
        {t('accessKeysPage.list.empty')}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <Table className="min-w-[1120px]">
          <TableHeader className="bg-muted/70 text-muted-foreground">
            <TableRow variant="static">
              <TableHead className="w-10">
                <Checkbox
                  checked={partiallySelected ? 'indeterminate' : allSelected}
                  aria-label={t('accessKeysPage.bulk.selectAll')}
                  onCheckedChange={onToggleAll}
                />
              </TableHead>
              <TableHead>{t('accessKeysPage.list.index')}</TableHead>
              <TableHead>{t('accessKeysPage.list.key')}</TableHead>
              <TableHead>{t('accessKeysPage.list.owner')}</TableHead>
              <TableHead>{t('accessKeysPage.list.credentialScope')}</TableHead>
              <TableHead>{t('accessKeysPage.list.modelScope')}</TableHead>
              <TableHead>{t('accessKeysPage.list.length')}</TableHead>
              <TableHead>{t('accessKeysPage.list.status')}</TableHead>
              <TableHead className="bg-muted sticky right-0 z-10 w-[168px] text-right sm:w-[360px]">
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
                      key: resource.maskedValue,
                    })}
                    onCheckedChange={() => onToggleSelection(resource)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatAccessKeySequence(resource)}
                </TableCell>
                <TableCell>
                  <p className="font-mono text-xs">{resource.maskedValue}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t('accessKeysPage.list.prefixSuffix', {
                      prefix: resource.prefix,
                      suffix: resource.suffix,
                    })}
                  </p>
                </TableCell>
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
                <TableCell>
                  <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    {t('accessKeysPage.status.accepted')}
                  </span>
                </TableCell>
                <TableCell className="group-hover:bg-accent bg-card sticky right-0 z-10 w-[168px] text-right transition-colors sm:w-[360px]">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      className="px-2"
                      aria-label={t('accessKeysPage.actions.view')}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelectKey(resource)
                      }}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{t('accessKeysPage.actions.view')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      className="px-2"
                      aria-label={t('accessKeysPage.actions.edit')}
                      onClick={(event) => {
                        event.stopPropagation()
                        onEditKey(resource)
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{t('accessKeysPage.actions.edit')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      className="px-2"
                      aria-label={t('accessKeysPage.actions.copy')}
                      onClick={(event) => {
                        event.stopPropagation()
                        onCopy(resource)
                      }}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{t('accessKeysPage.actions.copy')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="destructiveText"
                      size="sm"
                      className="px-2"
                      aria-label={t('accessKeysPage.actions.delete')}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeleteKey(resource)
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{t('accessKeysPage.actions.delete')}</span>
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

function AccessKeyDetailContent({
  mode,
  resource,
  users,
  channelGroups,
  modelGroups,
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
  mutating: boolean
  onModeChange: (mode: DetailMode) => void
  onCancel: () => void
  onCreate: (value: string) => Promise<void>
  onUpdate: (value: string) => Promise<void>
  onDelete: () => void
  onCopy: (resource: AccessKeyResource) => Promise<void>
}) {
  const { t } = useTranslation()
  const [showSecret, setShowSecret] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setShowSecret(false)
    setLocalError(null)
    setKeyValue(mode === 'edit' && resource ? resource.value : '')
  }, [mode, resource])

  const validateKey = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setLocalError(t('accessKeysPage.form.validation.required'))
      return null
    }

    return trimmed
  }

  const handleCreateOrUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = validateKey(keyValue)
    if (!trimmed) return

    try {
      setLocalError(null)
      if (mode === 'create') {
        await onCreate(trimmed)
      } else {
        await onUpdate(trimmed)
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="p-5">
        <form className="grid gap-4" onSubmit={(event) => void handleCreateOrUpdate(event)}>
          <label className="grid gap-2 text-sm font-medium">
            <span>{t('accessKeysPage.form.keyValue')}</span>
            <div className="flex gap-2">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={keyValue}
                disabled={mutating}
                placeholder="sk-..."
                onChange={(event) => setKeyValue(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
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
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={mutating}
            onClick={() => setKeyValue(generateAccessKey())}
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
          <Button size="sm" variant="outline" onClick={() => setShowSecret((current) => !current)}>
            {showSecret ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
            {showSecret ? t('accessKeysPage.actions.hide') : t('accessKeysPage.actions.reveal')}
          </Button>
          <Button
            size="sm"
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
          ['prefix', resource.prefix],
          ['suffix', resource.suffix],
          ['length', String(resource.length)],
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
      <form className="mt-5 grid gap-4" onSubmit={handleReplace}>
        <label className="grid gap-2 text-sm font-medium">
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

  const handleCreate = async (value: string) => {
    await workbench.createKey(value)
    toast.success(t('accessKeysPage.toast.created'))
    setDetailMode('detail')
    setSelectedKeyId(null)
    setDetailSheetOpen(false)
  }

  const handleUpdate = async (value: string) => {
    if (!selectedResource) return
    await workbench.updateKey({
      resource: selectedResource,
      value,
    })
    toast.success(t('accessKeysPage.toast.updated'))
    setDetailMode('detail')
  }

  const handleReplace = (values: string[]) => {
    setConfirmation({ type: 'replace', values })
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

    if (currentConfirmation.type === 'replace') {
      await workbench.replaceKeys(currentConfirmation.values)
      toast.success(t('accessKeysPage.toast.replaced'))
      setSelectedKeyId(null)
      setDetailMode('detail')
      setReplaceSheetOpen(false)
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
        ? selectedResource.maskedValue
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
              key: confirmation.resource.maskedValue,
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
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal">
              {t('accessKeysPage.header.title')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              variant="outline"
              size="sm"
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
              size="sm"
              onClick={() => {
                setSelectedKeyId(null)
                setDetailMode('create')
                setDetailSheetOpen(true)
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('accessKeysPage.actions.new')}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-2.5 py-1 text-xs font-medium">
            {t('accessKeysPage.header.total', { count: resources.length })}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('accessKeysPage.header.accepted')}
          </span>
          <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 text-xs">
            {t('accessKeysPage.header.updatedAt', {
              time: formatDateTime(workbench.snapshot.fetchedAt),
            })}
          </span>
        </div>
      </div>

      <div className="bg-card min-w-0 rounded-lg border p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t('accessKeysPage.list.title')}</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {t('accessKeysPage.list.description')}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              disabled={workbench.mutating}
              onClick={() => setReplaceSheetOpen(true)}
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
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('accessKeysPage.list.filterPlaceholder')}
              />
            </div>
          </div>
        </div>
        <div className="mt-4">
          {selectedKeyIds.size > 0 ? (
            <div className="bg-muted/60 mb-3 flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">
                {t('accessKeysPage.bulk.selected', { count: selectedKeyIds.size })}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={workbench.mutating}
                  onClick={() => setSelectedKeyIds(new Set())}
                >
                  {t('accessKeysPage.bulk.clearSelection')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
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
          />
        </div>
      </div>

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

      <Sheet open={replaceSheetOpen} onOpenChange={setReplaceSheetOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-5">
            <SheetTitle>{t('accessKeysPage.replace.title')}</SheetTitle>
            <SheetDescription>{t('accessKeysPage.replace.description')}</SheetDescription>
          </SheetHeader>
          <ReplaceAccessKeysContent
            resources={resources}
            mutating={workbench.mutating}
            onCancel={() => setReplaceSheetOpen(false)}
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
