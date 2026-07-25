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
- `src/styles/effects.css` owns cross-theme loading and motion effects.
- `src/styles/globals.css` stays as the style entrypoint plus minimal global base rules.

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

Recommended hierarchy:

- Page title: compact semibold around `text-xl`.
- Section title: `text-base` or `text-sm` semibold depending on density.
- Field label: `text-sm` medium.
- Help text, metadata, tags: `text-xs` to `text-sm` muted.
- Code, route paths, config keys, and model IDs: mono only where literal precision helps.

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
- Hover states should change background, border, or text color, not layout.
- Avoid glassmorphism, heavy blur, glow, or floating decorative panels.

## Components

Control sizing:

- Shared form controls use one height scale: `sm` is 32px for dense table tools, `default` is 36px for general forms and actions, and `lg` is 40px for prominent or mixed-control filter rows.
- Input, select trigger, button, and toggle-group item sizes with the same name must resolve to the same visual height.
- Choose one control size for each horizontal toolbar row. Feature code may set width and spacing, but should not override component height with local `h-*` classes.
- Responsive filter layouts should reflow or wrap controls instead of changing their height independently at a breakpoint.
- Compact table toolbars may opt into the shared responsive compact modifier so every `sm` control in the row grows to 40px on narrow screens and returns to 32px from the `sm` breakpoint onward.

Action placement and emphasis:

- Place actions at the narrowest scope they affect. `PageHeader` owns page-wide or cross-view actions such as refresh and sync; `TableSurfaceHeader` owns actions for the current resource collection, such as create and import.
- A single-resource page may keep its primary action in `PageHeader`, but the same action must never be repeated in both the page header and a resource header.
- Each action group has at most one primary action. In the shared Button API, the primary visual treatment is `variant="default"`; omit the variant when that intent is clear.
- Use the primary treatment for the safest, most frequent next action in that scope, usually create or add. Refresh, sync, export, replace-all, and other supporting or broader-impact actions use `outline` by default.
- Destructive actions use the destructive treatment, and an action group does not need a primary button when every available action is secondary or risky.
- Expose only independent row-level tasks in resource-table action columns; do not repeat destinations already available in a detail view. Prefer no more than three visible actions, moving lower-frequency actions into an overflow menu when needed.
- Order safe actions before destructive actions, keep destructive actions last, and keep sticky action columns compact without covering adjacent content.

Tabs:

- Peer views use the shared Radix Tabs primitive so tab, tablist, tabpanel, focus movement, and trigger-to-panel relationships stay consistent.
- Tabs are flat navigation, not primary actions: use a quiet selected surface and a restrained accent indicator instead of filled primary buttons, card shadows, or separate outline buttons.
- Page-level and table-surface tabs share one visual language. Express hierarchy through placement and surrounding spacing, not a second trigger style.
- Keep tab lists on one horizontally scrollable line. Triggers use the responsive compact height: 40px on narrow screens and 32px from the `sm` breakpoint onward.
- Use text labels by default. Add icons only when they materially disambiguate otherwise similar destinations.
- Mounting inactive panels is a feature-level decision. Use `forceMount` only when leaving a tab must preserve local UI state or an already-mounted workflow.

Shell:

- Left sidebar is the global navigation anchor.
- Sidebar supports grouped navigation, collapsed icon rail, active route indicators, and mobile drawer behavior.
- Navigation items have stable height, clear icon/title alignment, and enough padding for scanning.
- Top bar contains command entry, theme, language, and global connection management.
- Keep the connection management action because it provides the global disconnect path.

Dashboard:

- Dashboard is the global overview.
- Lead with a concise operational verdict: disconnected, connected, ready, needs setup, degraded, or unsupported.
- Suggested actions respond to health gaps and should not duplicate the sidebar.
- Provider and credential summaries should become setup-oriented empty states when all counts are zero.
- Partial API failures should surface as degraded data status.

Resource pages:

- Use list/table plus detail sheet patterns for providers, credentials, access keys, usage, call diagnostics, runtime logs, and nodes.
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
- When a sheet drills into a secondary task, replace its header in place and keep back navigation at the header start; do not stack a second header inside the body.
- Leave enough spacing between sheet header actions and the first body control to avoid misclicks.
- Dialogs and confirm flows need stronger dark-mode contrast than the page background.
- Destructive confirms should name the object or operation being affected.

States:

- Loading uses skeletons with subtle shimmer.
- Empty states teach the next action.
- Error states distinguish unsupported backend behavior, unauthorized request, failed request, and partial data.
- Disabled controls must not look like primary actions.
- Primary actions must not look disabled.

## Do's and Don'ts

Do:

- Use the Management API as the hard product boundary.
- Keep API adapters and backend feature differences out of JSX.
- Keep visible copy in i18n locale files.
- Use lucide icons consistently and semantically.
- Use shadcn/ui dialogs, sheets, dropdowns, buttons, inputs, and skeletons before creating custom primitives.
- Make unsupported backend behavior explicit and recoverable.
- Prefer teal/slate restrained emphasis for control-console actions.
- Preserve layout stability for buttons, toolbars, tables, config fields, and navigation items.

Don't:

- Do not invent backend routes, fields, metrics, or bulk operations.
- Do not use browser-native `alert`, `confirm`, or `prompt`.
- Do not use gradient text, decorative orbs, bokeh, glass cards, or hero metric templates.
- Do not nest cards inside cards.
- Do not use pure black sidebars or pure white active navigation blocks.
- Do not overuse purple, beige, parchment, espresso, or single-hue palettes.
- Do not let Russian, English, Simplified Chinese, or Traditional Chinese labels overflow buttons or cards.
- Do not hide partial API failures or unsupported backend behavior.
