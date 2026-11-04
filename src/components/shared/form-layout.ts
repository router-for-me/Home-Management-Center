/*
 * Form and filter layout.
 *
 * These three strings were previously written out at each call site, and they had
 * drifted the way repeated strings do: 124 field labels across six spellings, with
 * the type size sometimes on the label and sometimes on the span inside it, and
 * gaps of 1, 1.5 and 2; filter rows declared as three near-identical constants in
 * three files, two of them character-for-character the same.
 *
 * None of that was visible as a bug. It is visible as a table of differences with
 * no reason behind any of them, which is the thing a design system exists to stop.
 * A field is a field, so it has one spelling here.
 */

/**
 * A label wrapping its own control. The label element is the association, so no
 * `htmlFor` is needed; the text goes in a `<span>` and the control follows it.
 */
const fieldClassName = 'grid gap-1.5 text-sm font-medium'

/**
 * A group of fields. One column below 40rem — a phone has room for one field, and
 * two half-width fields at 375px are two truncated fields.
 */
const formGridClassName = 'grid gap-3 sm:grid-cols-2'

/**
 * A filter row above a table. Denser than a form grid because filters are short
 * and scanned together, and it keeps climbing past `sm` because a filter row is
 * usually the widest thing on the page.
 */
const filterGridClassName = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'

/** A filter row with fewer, wider controls, such as a date range plus one select. */
const narrowFilterGridClassName = 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3'

/*
 * The same two rows when they end in the advanced-filters toggle. The toggle
 * takes the cell after the last filter while the row wraps, and once every
 * filter fits on one line it takes an auto-width track at its end. A full-width
 * toggle bar under the row cost a line of its own at every width - 48px of a
 * request table's first screen.
 *
 * The five-filter row only takes that track from 2xl. Measured at 1280px, the
 * track would leave each filter 168px in Chinese and 147px in Russian, and the
 * input beside a search field's picker about 50px. Keep the track to the toggle
 * alone: a clear action beside it widened the track to 386px in Russian and did
 * the same to the search input at 1536px.
 */
const filterGridWithActionsClassName =
  'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]'
const narrowFilterGridWithActionsClassName =
  'grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]'

/** The cell holding a filter row's own controls. Stacks below 40rem like any button group. */
const filterActionsClassName = 'flex flex-col gap-2 sm:flex-row sm:items-center'

/** Equal-width filter slots: apply flex to unpadded wrappers, not their controls. */
const filterRowClassName = 'flex flex-col gap-2 sm:flex-row sm:items-center'
const flexibleFilterFieldClassName = 'min-w-0 sm:flex-1'

export {
  fieldClassName,
  filterActionsClassName,
  filterGridClassName,
  filterGridWithActionsClassName,
  filterRowClassName,
  flexibleFilterFieldClassName,
  formGridClassName,
  narrowFilterGridClassName,
  narrowFilterGridWithActionsClassName,
}
