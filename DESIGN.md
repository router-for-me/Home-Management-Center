# DESIGN.md

## Overview

Creative north star: **The Quiet Control Plane**.

Home Management Center should feel like a professional CLIProxyAPIHome management console: restrained, readable, precise, and built for repeated operational use. The UI should foreground service readiness, misconfiguration, and safe next actions instead of decorative analytics.

Default design register is product UI. Use familiar control-console patterns: left navigation, top context controls, resource tables, compact cards, sheets, confirmation dialogs, sticky action bars, and clear unsupported states.

Named rules:

- **Verdict Before Detail**: major pages lead with the current operational state before showing secondary metrics.
- **Backend State Is Visible**: unsupported, missing, or failed backend behavior appears as explicit UI states.
- **Cards Earn Their Border**: use cards for resource groups, repeated items, modals, and framed tools; avoid nested cards and decorative section cards.
- **Risk Has Weight**: destructive actions, remote access, secret changes, and diagnostics need stronger confirmation and clearer copy.
- **Density Without Compression**: keep layouts efficient while preserving readable spacing, stable control sizes, and clear scan paths.

## Colors

Color strategy: restrained product palette with cool tinted neutrals and one primary accent.

Theme direction:

- Use Slate as the neutral foundation for shell, body, cards, borders, and muted text.
- Use Teal as the primary accent for active states, primary actions, selected states, focus rings, and positive connection affordances.
- Light mode should feel calm and low-glare, with cool off-white content surfaces.
- Dark mode should feel like a professional control room, not a pure black terminal skin.
- Keep the light and dark themes derived from the same Slate and Teal token system.

Primary accent:

- Teal: `#0d9488`, `#14b8a6`, `#2dd4bf`
- Use teal sparingly for intent and state.
- Do not use teal as broad decoration or page wallpaper.

Neutral surfaces:

- Light background: cool slate off-white.
- Light cards: near-white with subtle border separation.
- Dark background: low-glare deep slate.
- Dark cards: elevated slate with enough contrast from the body background.

Sidebar:

- Avoid pure black sidebars and pure white active navigation blocks.
- Dark sidebar should use deep slate or muted navy-slate.
- Hover should brighten only the hovered item.
- Active navigation should use tinted teal or slate surfaces with readable foreground.
- Collapsed and expanded states must preserve icon recognition, hit area, and active route clarity.

Semantic colors:

- Amber for warnings, degraded states, validation issues, and configuration attention.
- Red for deletion, log clearing, dangerous diagnostics, irreversible replacement, or security-sensitive failure.
- Emerald or green for success and confirmed readiness.
- Sky or blue for neutral information, not primary brand emphasis.

Theme tokens:

- Use `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--primary`, `--success`, `--warning`, `--info`, and `--destructive`.
- Use `--overlay` for dialogs, sheets, command palette, and blocking overlays.
- Avoid hard-coded pure white, pure black, or one-off Tailwind color families when a token exists.
- `src/styles/theme-tokens.css` owns Slate theme mappings and semantic color variables.
- `src/styles/control-tokens.css` owns the control step ramp, the type roles, and the interaction state layer, including the hover colors every bordered control shares.
- `src/styles/effects.css` owns cross-theme loading and motion effects. A hover or size rule does not belong here: an unlayered rule outranks every layer, so one written here silently takes precedence over the shared control state.
- `src/styles/globals.css` is the style entrypoint plus the global base rules, and it owns the table layer: the z-index scale, the sticky action column, and the per-locale action column widths.

Do not introduce broad purple gradients, warm parchment backgrounds, beige/brown themes, decorative bokeh, floating orbs, or gradient text.

## Typography

Use Inter Variable as the product UI default, with broad system and Noto fallbacks for Simplified Chinese, Traditional Chinese, English, and Russian:

`"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Noto Sans SC", "Noto Sans TC", "Helvetica Neue", Arial, sans-serif`

Use a separate technical mono stack for API paths, config keys, logs, masked secrets, request IDs, route paths, and YAML:

`"IBM Plex Mono", "Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`

Rules:

- Product UI uses one sans family.
- Do not introduce display fonts for labels, tables, forms, or navigation.
- Use fixed rem sizes, not viewport-scaled type.
- Keep headings compact. Reserve large display type for true first-run or empty-state moments.
- Labels and table text should prioritize recognition over expressiveness.
- Body prose should stay within 65 to 75 characters when used in explanations.
- Letter spacing should be normal. Avoid negative tracking.

Type roles:

- Text takes a role, not a scale step. `text-xs` and `text-sm` said nothing about what a string is; the role does, and it carries its own line height so a 16px leading cannot land in a 20px row.
- `text-page-title` 20/28 semibold; `text-section-title` 16/24 semibold; `text-body` 14/20; `text-label` 14/20 medium; `text-meta` 12/16; `text-code` 12/16 mono.
- Control labels come from the control step, not from a role. Never set type on a control.
- Prose keeps its own leading: a paragraph may run looser than `text-body` where the line length asks for it.

## Layout

- The app shell uses a left global sidebar and a right content workspace.
- Main pages should have one clear primary surface, not several equal-weight panels.
- Tables and workspaces are usually the visual center for resource pages.
- Keep repeated controls aligned across pages: refresh, create, filter, view, edit, delete, save, and cancel.
- Use sticky action bars only when they protect long-page workflows.
- Avoid fixed-height panels unless they solve a real scroll containment problem.
- Do not nest cards inside cards.
- Do not make every section a card by default.

## Elevation

Flat by default. Elevation should communicate layering, not decoration.

- Page background and sidebar provide the primary depth relationship.
- Cards use borders first, subtle shadows only where separation is necessary.
- Sticky action bars may use light shadow and backdrop treatment to remain readable while scrolling.
- Sheets, dialogs, dropdowns, command palette, and popovers use stronger elevation because they sit above the task surface.
- Hover states change color, never layout. Which colors is not a free choice; see the control families under Interaction states.
- Avoid glassmorphism, heavy blur, glow, or floating decorative panels.

## Components

Control sizing:

- One height scale, named the same as the tokens: `xs` 24, `sm` 28, `md` 32, `lg` 36, `xl` 40. `md` for dense table tools, `lg` for forms, top bars and ordinary actions, `xl` for a prominent action or a mixed filter row, `xs` and `sm` for controls inside a badge or a table cell.
- Input, select trigger, button, and toggle-group items of the same size name resolve to the same height, and `size="md"` renders `.control-md` with no table in between.
- One control size per toolbar row. Feature code sets width and spacing, never height or type; `home-ui/no-control-size-override` fails the build on both.
- Responsive layouts reflow or wrap; they do not change control height at a breakpoint.
- Touch targets belong to the step, not the caller. `sm`, `md` and `lg` grow to a 40px floor below 40rem or on a coarse pointer, so no toolbar has to remember to opt in and none can forget. `xs` is excluded: it exists for controls inside a badge or a table cell, where a 40px floor would break the row it sits in.
- The ramp is density-ready — `[data-density='compact']` retargets every step with no component change — but no switch is exposed. Treat it as structure, not a feature to build on.

Overflow in controls:

- Backend values are unbounded, so controls clip rather than grow or wrap; height never depends on data.
- A displayed value is one line ending in an ellipsis, full string on hover; long ids differ at the tail, where the ellipsis lands.
- Option lists may grow past their trigger, up to the viewport, so the value is readable where it is chosen; beyond that they truncate too.

Action placement and emphasis:

- Actions sit at the narrowest scope they affect: `PageHeader` for page-wide ones like refresh, `TableSurfaceHeader` for collection ones like create.
- A single-resource page may keep its primary action in `PageHeader`, but no action appears in both headers.
- One primary per group, given to the safest frequent next action, usually create. Refresh, sync, export, and replace-all are `outline`.
- Destructive actions take the destructive treatment; a group of only secondary or risky actions needs no primary.
- Row action columns carry independent row-level tasks only, never a destination the detail view already offers.
- A bulk action bar draws from the same family as a row action column: no surface at rest, destructive in red. It is a set of row actions addressed to several rows, not a toolbar.
- The table header has one background. A sticky column has to paint an opaque copy of it, and can only match one value.
- Destructive actions come last, and sticky action columns never cover adjacent content.

Row actions:

- A row's actions are declared, not laid out. The shared row-action component owns the count, the styling, the ordering, and the width; feature code passes the actions in priority order and nothing else.
- Three controls in the column, and the overflow trigger is one of them. Counting only the labelled ones is what let a column reach four.
- One treatment for all of them: icon plus label, no surface at rest, destructive in red. A filled or outlined control here would repeat a page's primary action once per row.
- Destructive comes last in whatever group it renders in, so priority order and reading order stay separate concerns.
- The reserved width follows the control count and the locale. Label lengths differ enough between Chinese and Russian that one number cannot serve both without either clipping or waste, so the width is measured per locale and never estimated.

Compact viewport:

- One boundary, and two questions behind it that must not be conflated. Width decides a layout's shape. Pointer coarseness decides how big a target is. Answering both with one condition puts a touched tablet into a phone layout it has room to avoid.
- Compact is a different shape, never a smaller feature set. Everything reachable on a desktop is reachable on a phone.
- A narrow viewport buys space by collapsing repetition, not by shrinking type or hiding function. An action column becomes one overflow trigger; a single action stays a direct tap, because a menu of one costs a step and saves nothing.
- A wide table gives up columns rather than access: every row opens a detail view carrying every field, so a dropped column is one tap away. Two survive — which row this is, and the one field that says the most about it, which is status on a resource table and amount on a ledger.
- Whatever a collapsed layout falls back on inherits the touch floor. Menus carry the weight once a column is behind a trigger, so they are targets on the same terms as controls.
- Where a dense grid of small targets cannot clear the floor, the grid changes shape and the targets do not change padding. Enough targets in a narrow row will not fit at any hit-area size, and hit areas grown into each other just select the neighbour. Fewer columns and more rows is the honest answer.
- A panel over a phone is the task, not a panel: full width below the boundary, capped to a panel above it. Overlays measure their height against the visible viewport, not the layout one, or a software keyboard pushes them past the fold.
- A group of buttons stacks and stretches rather than wraps. Wrapping leaves each button its own width, and a column of unequal buttons with ragged space beside them reads as several things instead of one group.
- The page reserves its scrollbar track. Overlays lock the page while open, and where a scrollbar takes up space, removing it widens the viewport and the layout jumps as the overlay opens.
- Claims about narrow viewports are measured at that width in a browser. Every number behind these rules came from one.

Charts:

- Charts come from the shared chart primitive, not from hand-drawn SVG. A hand-drawn chart owes its own scales, its own tooltip and its own keyboard model, and it pays for them in a width fixed before anyone knows the viewport.
- Height is fixed; width is whatever it is given. An aspect ratio that reads well on a desktop turns a phone chart into a strip.
- A chart is one focusable thing the arrow keys walk, not a row of focusable points. A tab stop per data point is a keyboard trap with extra steps.
- Axis ticks thin out on narrow screens. Formatted timestamps do not shrink, so fewer of them is the only way they stop colliding.
- The first and last tick align to their edge rather than centring on it. A centred label at the end of an axis puts half of itself outside the plot, where it is clipped; widening the margin to hide that pays for the longest label in the longest locale on every viewport, and still guesses.

Forms and filters:

- A field, a field group and a filter row each have one spelling, kept in one place. These drift faster than anything else, because every author writes one and no single version looks wrong.
- Field groups are one column on a phone. Two half-width fields at that width are two truncated fields.
- A field offering a fixed set of values shows them. A suggestion list that filters against what is already typed shows one option when the field arrives pre-filled, which reads as the only option there is.

Tabs:

- Peer views use the shared Radix Tabs primitive, so the tablist, panel, and focus wiring stays consistent.
- Tabs are flat navigation, not actions: a quiet selected surface and a restrained indicator, never filled buttons, shadows, or outline buttons.
- Page-level and table-surface tabs share one visual language; express hierarchy through placement and spacing, not a second trigger style.
- Tab lists stay on one horizontally scrollable line, and triggers use the shared responsive compact height.
- Text labels by default; add an icon only when it disambiguates otherwise similar destinations.
- Use `forceMount` only when leaving a tab must preserve local state or an already-running workflow.

Shell:

- Left sidebar is the global navigation anchor.
- Sidebar supports grouped navigation, collapsed icon rail, active route indicators, and mobile drawer behavior.
- Navigation items have stable height, clear icon/title alignment, and enough padding for scanning. A navigation icon starts where the header logo starts; two different insets in one rail read as a mistake.
- The sidebar header and the workspace header are the same height. They sit side by side and their bottom borders are read as one line.
- The sidebar is as wide as its widest label needs and no wider. A decorative subtitle is not a reason to widen a rail every page pays for.
- The product mark is the way out of the console, back to where an identity is chosen. Every authenticated surface needs that door.
- Top bar contains command entry, theme, language, and global connection management.
- Keep the connection management action because it provides the global disconnect path.

Dashboard:

- Dashboard is the global overview.
- Lead with a concise operational verdict: disconnected, connected, ready, needs setup, degraded, or unsupported.
- Suggested actions respond to health gaps and should not duplicate the sidebar. A panel that summarises does not also need a link to the page it summarises.
- A hover affordance means the thing under it is actionable. Showing one on a card that only reports makes the reader test which cards lie.
- Provider and credential summaries should become setup-oriented empty states when all counts are zero.
- Partial API failures should surface as degraded data status.

Resource pages:

- Use list/table plus detail sheet patterns for providers, credentials, access keys, usage, call diagnostics, runtime logs, and nodes.
- Keep resource headers full-width. Place inset resource content in a shared padded layer with its own visual boundary; treat full-bleed layouts as explicit exceptions.
- Place create/import actions close to the resource header.
- Put view, edit, and delete actions in explicit operation columns when row actions are not obvious.
- Use component-library confirmation dialogs for destructive actions.
- Search inputs should act directly when the interaction is obvious. Avoid duplicate search buttons when Enter or live filtering is sufficient.

Config workspace:

- Use one visual workspace for supported runtime settings.
- The config workspace uses sections, not a linear wizard.
- Save, reload, dirty state, validation state, and view changes belong in a sticky action bar inside the workspace.
- Do not expose a second raw-editing path in the product UI.
- Sensitive fields use hidden inputs with explicit reveal controls.

Sheets and dialogs:

- Sheets should slide from the side with a clear header, body, and optional footer.
- A form filling a sheet is built from the shared scaffold, header and footer fixed and the body the only part that scrolls. A form that sizes to its own content cannot shrink, so a short viewport clips the bottom off and takes the submit button with it — present, and unreachable.
- When a sheet drills into a secondary task, replace its header in place and keep back navigation at the header start; do not stack a second header inside the body.
- Leave enough spacing between sheet header actions and the first body control to avoid misclicks.
- Dialogs and confirm flows need stronger dark-mode contrast than the page background.
- Destructive confirms should name the object or operation being affected.

Interaction states:

- A hover means one thing everywhere: this is what you are about to act on. It looks the same on every control in the same family, and a control never invents its own.
- Controls fall into three families by what their surface is made of, and the family decides the hover:
  - **Bordered** — the control owns its border: outline buttons, inputs, select triggers, textareas, checkboxes, radios. Border and background both move, through `.control-bordered`. Never write a `hover:border-*` or `hover:bg-*` pair on one of these.
  - **Filled** — the fill is the control: default, destructive and secondary buttons, a checked box, a switch track. Hover deepens that fill, written where the fill is, because only the control knows what color it is currently filled with.
  - **Segmented** — a container owns the border and the items are surfaces inside it: tabs, toggle groups. Background only; a second border drawn inside the first reads as noise.
- Focus is one ring on every primitive: `focus-visible:border-ring`, `focus-visible:ring-ring/50`, `focus-visible:ring-[3px]`. Hover and focus are separate signals and may show at once.
- Hover is never the only way to identify a control or its value; it adds emphasis to something already legible at rest.
- `.control-bordered` lives in the utilities layer, not the components layer. A layer beats specificity outright, so from the components layer it lost to every `bg-*` a primitive already set. Anything that must override it needs higher specificity, not a later rule.
- The class owns the transition too. Do not add a `transition-*` utility to a bordered control: it replaces the property list and silently stops the border and background from animating.

Time range filters:

- Use `DateTimeRangePicker` for every date or time range, with `precision="date"` for calendar-day reports and `precision="datetime"` for events and logs.
- Keep one trigger in the filter row. Presets and the custom calendar share its popover; choosing custom changes the panel in place, without adding another filter row or native date fields.
- Let the page's filter layout own the trigger width, stable across presets and custom ranges. Usage overview and request records keep the same equal-width grid columns as their neighboring filters. Billing gives all four filter items the same flex basis and growth so they share each row equally. User reports use a compact 11rem trigger, while runtime logs reserve 22rem for the complete pair of date-and-time values. Below 40rem, triggers fill their available row width.
- Size the preset list to its trigger and content; size the calendar popover independently, without spanning extra filter columns to fit it. Truncate applied ranges only when the available column or viewport cannot fit them, and retain their full accessible label and title.
- Presets apply immediately. Custom edits stay in a draft until Apply; Cancel, Escape and dismissal discard the draft. Clear empties the draft and resets selection to the start date.
- The endpoint the user edits wins. Align the opposite endpoint when necessary, including time edits and date reselection on the same day. Disable calendar dates outside the active endpoint's bounds.
- Show the applied timezone. Keep API-specific date expansion and timestamp conversion in adapters.
- Below 40rem show one month. Constrain the popover to the viewport, scroll its body and keep its actions visible. Calendar days use the control step and support arrow keys, Home/End and Page Up/Down.

Data states:

- Loading uses skeletons with subtle shimmer.
- Empty states teach the next action.
- Error states distinguish unsupported backend behavior, unauthorized request, failed request, and partial data.
- Disabled controls must not look like primary actions, and take no hover at all.
- Primary actions must not look disabled.

## Do's and Don'ts

Do:

- Use the Management API as the hard product boundary.
- Keep API adapters and backend feature differences out of JSX.
- Keep visible copy in i18n locale files.
- Use lucide icons consistently and semantically.
- Use shadcn/ui dialogs, sheets, dropdowns, buttons, inputs, and skeletons before creating custom primitives.
- Pick a control step and let it carry height, padding, gap, type, radius and icon size together.
- Let a control's family decide its hover, so the next one has an answer to copy instead of a choice to make.
- Declare a row's actions through the shared component and let it decide the count, the styling and the width.
- Measure a responsive claim at the width it is about to be made at.
- Make unsupported backend behavior explicit and recoverable.
- Prefer teal/slate restrained emphasis for control-console actions.
- Preserve layout stability for buttons, toolbars, tables, config fields, and navigation items.

Don't:

- Do not invent backend routes, fields, metrics, or bulk operations.
- Do not use browser-native `alert`, `confirm`, or `prompt`.
- Do not set height, box size or type on a control primitive; change the step instead. Lint fails the build on this.
- Do not write a `hover:border-*` / `hover:bg-*` pair on a bordered control, and do not add a `transition-*` utility to one.
- Do not hand-build an action column, put a fourth control in one, or give one an outlined or filled button.
- Do not use gradient text, decorative orbs, bokeh, glass cards, or hero metric templates.
- Do not nest cards inside cards.
- Do not use pure black sidebars or pure white active navigation blocks.
- Do not overuse purple, beige, parchment, espresso, or single-hue palettes.
- Do not let Russian, English, Simplified Chinese, or Traditional Chinese labels overflow buttons or cards.
- Do not hide partial API failures or unsupported backend behavior.
