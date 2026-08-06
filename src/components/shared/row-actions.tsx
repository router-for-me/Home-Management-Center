import { Loader2, type LucideIcon, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsCompactViewport } from '@/hooks/use-compact-viewport'
import { cn } from '@/lib/utils'

/*
 * Row actions.
 *
 * The action column used to be whatever the feature put in it, and the cost
 * landed on the narrowest viewport: three labelled buttons measured 263px at
 * 375px, 70% of the screen, leaving 110px for every other column and pushing the
 * table 101px past its own scroll container. Icons alone did not fix it either —
 * four icon buttons still took 186px, half the viewport.
 *
 * So the column stops being a row of buttons and becomes one decision. Below
 * 40rem a row with more than one action collapses to a single overflow trigger,
 * and the column sizes itself to that one 40px control. The actions do not
 * change, only how many of them are spent as width.
 *
 * A menu is also the answer above 40rem once a row carries more tasks than the
 * column has slots, which is what DESIGN.md already asked for and what nothing
 * enforced: two tables had grown to four labelled buttons.
 */

type RowActionTone = 'default' | 'destructive'

type RowAction = {
  /** Stable across renders; also the menu item's key. */
  id: string
  /** Already translated. Shown as the button label, the menu item, and the icon button's accessible name. */
  label: string
  /*
   * A fuller accessible name where the visible label is too short to stand on its
   * own — "Delete" in a column of them versus "Delete price rule for gpt-4". The
   * visible text stays short; only what is announced grows.
   */
  ariaLabel?: string
  icon: LucideIcon
  onSelect: () => void
  /**
   * `destructive` reddens the control and the menu item, and moves it to the end
   * of whichever group it renders in. List by priority; ordering is not your job.
   */
  tone?: RowActionTone
  disabled?: boolean
  /** Work is in flight for this row: the icon becomes a spinner and the action stops accepting input. */
  busy?: boolean
}

/*
 * Callers build this list inline and some entries are conditional, so falsy
 * entries are part of the contract rather than something each call site filters
 * for itself.
 */
type RowActionInput = RowAction | null | undefined | false

/*
 * Three controls in the column, counting the overflow trigger as one of them.
 *
 * The ceiling is on controls, not on actions, and that distinction is the whole
 * point. Reading it as three actions plus a trigger is how the access-key table
 * ended up with four buttons in a column already too wide: each one it added was
 * "still within three", because the trigger was not being counted. So a row with
 * four tasks shows two of them and a trigger, not three and a trigger, and the
 * column has one worst case to be sized for instead of two.
 */
const ACTION_CONTROL_LIMIT = 3

/*
 * Destructive last, per group.
 *
 * Callers list actions by priority, which is the order that decides what stays
 * inline. It is not automatically the order to render in: a table with four
 * actions puts delete third so it survives the inline cut, and then the collapsed
 * menu showed Delete directly above Copy. Reaching for the benign item and
 * overshooting onto the destructive one is a real cost, so the rule is applied
 * here to whatever group an action lands in rather than asked of each call site
 * twice, once per layout.
 *
 * Sorting within a group never changes its membership, so priority still decides
 * what is inline and this only decides where it sits.
 */
function destructiveLast(actions: RowAction[]) {
  return [...actions].sort(
    (left, right) => Number(left.tone === 'destructive') - Number(right.tone === 'destructive'),
  )
}

function RowActions({
  actions,
  /**
   * Names the row the menu belongs to. A column of identical "More" buttons
   * gives a screen reader no way to tell which row it is on, so this is required
   * and callers pass the row's own identity.
   */
  menuLabel,
  controlLimit = ACTION_CONTROL_LIMIT,
  className,
}: {
  actions: RowActionInput[]
  menuLabel: string
  controlLimit?: number
  className?: string
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompactViewport()

  const visible = actions.filter((action): action is RowAction => Boolean(action))
  if (visible.length === 0) return null

  /*
   * One action stays a button on every viewport. Collapsing it would trade a
   * direct tap for a menu holding a single item, and the column is already as
   * narrow as the trigger alone would make it.
   *
   * Everything past that: compact spends its whole budget on the trigger, and
   * wide spends it on labels until a trigger is needed, at which point the
   * trigger takes one of the slots rather than being added beside them.
   */
  const inlineCount =
    visible.length === 1
      ? 1
      : isCompact
        ? 0
        : visible.length <= controlLimit
          ? visible.length
          : controlLimit - 1
  const inline = destructiveLast(visible.slice(0, inlineCount))
  const overflow = destructiveLast(visible.slice(inlineCount))

  return (
    <div
      className={cn('table-action-cell-content', className)}
      /*
       * Some tables make the whole row activate its detail view. Acting on a row
       * is not the same as opening it, so the boundary is drawn once here rather
       * than in every handler.
       */
      onClick={(event) => event.stopPropagation()}
    >
      {inline.map((action) => {
        const Icon = action.busy ? Loader2 : action.icon
        return (
          <Button
            key={action.id}
            type="button"
            variant={action.tone === 'destructive' ? 'destructiveText' : 'text'}
            size={isCompact ? 'icon-md' : 'md'}
            className={isCompact ? undefined : 'px-2'}
            disabled={action.disabled || action.busy}
            aria-label={action.ariaLabel ?? (isCompact ? action.label : undefined)}
            onClick={action.onSelect}
          >
            <Icon className={action.busy ? 'animate-spin' : undefined} aria-hidden="true" />
            {isCompact ? null : action.label}
          </Button>
        )
      })}

      {overflow.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/*
              `text`, like the buttons it sits beside. The trigger is a row action
              too, and a ghost control next to them would hover by moving its
              background while they moved their foreground — two answers to the
              same question, six pixels apart.
            */}
            <Button
              type="button"
              variant="text"
              size="icon-md"
              aria-label={t('rowActions.more', { target: menuLabel })}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {overflow.map((action) => {
              const Icon = action.busy ? Loader2 : action.icon
              return (
                <DropdownMenuItem
                  key={action.id}
                  variant={action.tone === 'destructive' ? 'destructive' : 'default'}
                  disabled={action.disabled || action.busy}
                  aria-label={action.ariaLabel}
                  onSelect={action.onSelect}
                >
                  <Icon className={action.busy ? 'animate-spin' : undefined} aria-hidden="true" />
                  {action.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

/*
 * The action types stay internal on purpose. Every call site builds its list as
 * an inline literal and gets checked against the prop, so exporting them would
 * only invite a feature to re-declare its actions in a named local type and drift
 * from the shape this component actually accepts.
 */
export { RowActions }
