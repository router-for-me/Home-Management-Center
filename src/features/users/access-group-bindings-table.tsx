import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyValueButton } from '@/components/shared/diagnostic-detail'
import { RowActions } from '@/components/shared/row-actions'
import { useSecondaryColumns } from '@/components/shared/table-columns'
import { tableHeaderClassName } from '@/components/shared/table-surface'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatOptionalTime, groupListLabel } from '@/features/users/users-format'
import type {
  AccessGroupDetailResource,
  AccessGroupKind,
  AccessGroupResource,
} from '@/lib/api/management/access-groups'
import { cn } from '@/lib/utils'

function BoundCredentialIdentity({ detail }: { detail: AccessGroupDetailResource }) {
  const { t } = useTranslation()
  const credential = detail.credential
  const name = credential?.displayName !== detail.targetId ? credential?.displayName : null
  const state = credential === null ? 'unresolved' : credential?.state

  return (
    <div className="grid min-w-0 gap-0.5">
      {name && (
        <span className="truncate font-medium" title={name}>
          {name}
        </span>
      )}
      <div className="flex min-w-0 items-center gap-1">
        <code
          className="text-muted-foreground min-w-0 truncate text-xs select-all"
          title={detail.targetId}
        >
          {detail.targetId}
        </code>
        <CopyValueButton
          value={detail.targetId}
          copyLabel={t('usersPage.groups.copyCredentialId', { id: detail.targetId })}
          copiedLabel={t('usersPage.groups.credentialIdCopied')}
        />
      </div>
      {(credential?.provider || state) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          {credential?.provider && (
            <span className="truncate" title={credential.provider}>
              {credential.provider}
            </span>
          )}
          {state && (
            <span className="text-warning-foreground dark:text-warning">
              {t(`usersPage.groups.credentialState.${state}`)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function AccessGroupBindingsTable({
  kind,
  groupDetails,
  channelGroups,
  channelBindingsSupported,
  onDeleteDetail,
}: {
  kind: AccessGroupKind
  groupDetails: AccessGroupDetailResource[]
  channelGroups: AccessGroupResource[]
  channelBindingsSupported: boolean
  onDeleteDetail: (detail: AccessGroupDetailResource) => void
}) {
  const { t } = useTranslation()
  const showSecondaryTime = useSecondaryColumns() || kind === 'model'
  const showChannels = kind === 'model' && channelBindingsSupported
  // Fixed proportions keep stacked group cards' tables column-aligned regardless of content.
  const targetColumnWidth = kind === 'channel' ? undefined : showChannels ? 'w-[40%]' : 'w-[56%]'
  const timeColumnWidth = kind === 'channel' ? 'w-[28%]' : showChannels ? 'w-[20%]' : 'w-[26%]'

  return (
    <div className="overflow-x-auto">
      <Table
        className={cn(
          'table-fixed',
          kind === 'model' && (showChannels ? 'min-w-[760px]' : 'min-w-[620px]'),
        )}
      >
        <colgroup>
          <col className={targetColumnWidth} />
          {showChannels && <col className="w-[26%]" />}
          {showSecondaryTime ? <col className={timeColumnWidth} /> : null}
          <col className="table-action-column-1" />
        </colgroup>
        <TableHeader className={tableHeaderClassName}>
          <TableRow variant="static">
            <TableHead>
              {kind === 'channel'
                ? t('usersPage.groups.credential')
                : t('usersPage.groups.modelId')}
            </TableHead>
            {showChannels ? <TableHead>{t('usersPage.groups.detailChannels')}</TableHead> : null}
            {showSecondaryTime ? <TableHead>{t('usersPage.list.updatedAt')}</TableHead> : null}
            <TableHead className="text-right">{t('usersPage.list.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupDetails.length === 0 ? (
            <TableRow variant="static">
              <TableCell
                colSpan={2 + Number(showSecondaryTime) + Number(showChannels)}
                className="text-muted-foreground py-8 text-center"
              >
                {t('usersPage.groups.noDetails')}
              </TableCell>
            </TableRow>
          ) : (
            groupDetails.map((detail) => {
              const channelsLabel =
                detail.channels.length > 0
                  ? groupListLabel(
                      channelGroups,
                      detail.channels,
                      t('usersPage.status.notReturned'),
                    )
                  : t('usersPage.groups.detailChannelsInherit')

              return (
                <TableRow key={detail.id} variant="resource">
                  <TableCell>
                    {kind === 'channel' ? (
                      <BoundCredentialIdentity detail={detail} />
                    ) : (
                      <span className="block truncate font-mono text-xs" title={detail.targetId}>
                        {detail.targetId}
                      </span>
                    )}
                  </TableCell>
                  {showChannels ? (
                    <TableCell className="text-muted-foreground truncate" title={channelsLabel}>
                      {channelsLabel}
                    </TableCell>
                  ) : null}
                  {showSecondaryTime ? (
                    <TableCell className="text-muted-foreground truncate">
                      {formatOptionalTime(detail.updatedAt, t('usersPage.status.notReturned'))}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <RowActions
                      menuLabel={detail.targetId}
                      actions={[
                        {
                          id: 'delete',
                          icon: Trash2,
                          label: t('usersPage.actions.delete'),
                          tone: 'destructive',
                          disabled: detail.numericId === null,
                          onSelect: () => onDeleteDetail(detail),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
