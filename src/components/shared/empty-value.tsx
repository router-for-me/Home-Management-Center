import { useTranslation } from 'react-i18next'

const emptyValueText = '—'

// A sparse row is the normal case in an operations console: most deployments
// fill a minority of these columns. A dash keeps those rows quiet while the
// accessible name still says why the cell is empty, and it leaves the word
// "unavailable" to mean only what it says elsewhere — a capability the backend
// cannot serve, not a column that happens to be blank.
function EmptyValue({ reason, hint }: { reason?: string; hint?: string }) {
  const { t } = useTranslation()
  const visible = reason ?? emptyValueText
  const spoken = hint ?? reason ?? t('common.emptyValue.notRecorded')

  // Muted, not faded: a stated reason is real text and has to clear 4.5:1,
  // and the token already sits far enough below the foreground to read as
  // absence.
  return (
    <span className="text-muted-foreground" title={spoken}>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true">{visible}</span>
    </span>
  )
}

// An access key that resolved but carries no user is a supported setup rather
// than missing data, and it is a different fact from a caller the backend never
// recorded at all. Request records and billing charges reach those two cases
// from different payloads — a client key id in one, a key label in the other —
// so each caller maps its own DTO and the wording stays in one place.
function CallerUser({ username, keyResolved }: { username: string | null; keyResolved: boolean }) {
  const { t } = useTranslation()

  if (username) return <>{username}</>
  if (keyResolved) {
    return (
      <EmptyValue
        reason={t('common.caller.userNotBound')}
        hint={t('common.caller.userNotBoundHint')}
      />
    )
  }

  return <EmptyValue reason={t('common.caller.userNotRecorded')} />
}

export { CallerUser, EmptyValue, emptyValueText }
