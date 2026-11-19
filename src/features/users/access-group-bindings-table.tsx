import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import {
  ScopeCredentialIdentity,
  ScopeModelIdentity,
} from '@/features/users/scope-binding-identity'
import { formatOptionalTime, groupListLabel, repeatedNames } from '@/features/users/users-format'
import type {
  AccessGroupDetailResource,
  AccessGroupKind,
  AccessGroupResource,
} from '@/lib/api/management/access-groups'
import { cn } from '@/lib/utils'

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
  const ambiguousCredentials = repeatedNames(
    groupDetails.map((detail) => detail.credential?.displayName),
  )
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
                      <ScopeCredentialIdentity
                        authId={detail.targetId}
                        displayName={detail.credential?.displayName}
                        provider={detail.credential?.provider}
                        state={detail.credential === null ? 'unresolved' : detail.credential?.state}
                        showId={ambiguousCredentials.has(detail.credential?.displayName ?? '')}
                        copyable
                      />
                    ) : (
                      <ScopeModelIdentity modelId={detail.targetId} />
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
