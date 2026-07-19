# PRODUCT.md

## Register

product

## Product

Home Management Center is the companion Web management console for CLIProxyAPIHome. It helps operators manage service readiness, model services, account credentials, client access keys, usage reporting, call diagnostics, runtime logs, system diagnostics, and runtime configuration from a browser.

This is not a marketing surface. Design serves people who need to understand whether the management service is ready, what is misconfigured, and which action is safest to take next.

## Users

- Self-hosted operators running CLIProxyAPIHome locally or on a private server.
- Developers configuring model providers, account credentials, client keys, logs, routing, and runtime settings.
- Platform engineers who need a compact operational console for debugging service readiness and configuration state.
- Teams evaluating a professional control-plane interface for CLIProxyAPIHome operations.

## Product Jobs

- Connect to the CLIProxyAPIHome management backend and make connection state obvious.
- Show service readiness at a glance.
- Manage model service keys without confusing them with client access keys.
- Manage account credentials created through OAuth login or file import.
- Inspect usage reporting, call diagnostics, runtime logs, request errors, nodes, versions, diagnostics, and configuration.
- Provide a visual configuration workspace for supported runtime settings.
- Represent unsupported, unavailable, or partially loaded backend data as explicit UI states.
- Provide a credible global interface in Simplified Chinese, Traditional Chinese, English, and Russian.

## Product Boundaries

- The frontend must preserve the backend API contract.
- The UI must not imply routes, fields, metrics, bulk operations, or automation that the Management API does not provide.
- Backend API differences belong in adapters and normalized state, not scattered across JSX.
- Billing reports use the reporting timezone configured by the backend; browser timezone is not an implicit billing-report default.
- Sensitive operations need clear intent, confirmation, and recoverable feedback.
- Backend data should be shown as operational facts, not decorative analytics.

## Product Personality

Calm, precise, operational, trustworthy.

The interface should feel like a serious control plane: clear hierarchy, restrained color, explicit risk, and practical recovery paths. It should not feel decorative, consumer-chatty, or like a generic SaaS dashboard template.

## Voice

- Use concrete operational language.
- Prefer short labels over explanatory prose inside dense UI.
- Explain risk before destructive or high-impact actions.
- Make unsupported, partial, or failed backend states understandable without requiring DevTools.
- Avoid hype, marketing claims, jokes, or vague productivity language.
- Keep API field names, provider IDs, model IDs, route paths, protocol names, and config keys literal.

## Information Architecture

- Dashboard: global overview, readiness verdict, key service counts, and suggested actions.
- Model services: provider grouping, model service keys, model reference data, create/edit/delete flows.
- Account credentials: OAuth and file-backed credentials, metadata, status, import, download, and model availability.
- Access keys: client-facing keys used by downstream clients.
- Usage: request records, token and cost trends, aggregate rankings, and credential attribution.
- Call diagnostics: realtime state, request health timelines, health attribution, and request log files.
- Runtime logs: gateway runtime log records, request error log files, download, and guarded clear flows.
- System config: visual config sections, change preview, validation, and guarded saving.
- System information: versions, nodes, runtime diagnostics, config summary, and guarded API call tools.

## Design Principles

- Operational verdict first: each major page should answer what is usable, what is blocked, and what to do next.
- Backend-aware by default: unsupported or missing API routes must become explicit UI states, not fake data.
- Familiar console patterns win: sidebar navigation, compact tables, sheets, dialogs, sticky action bars, and predictable filters.
- No card sprawl: cards are for grouped resources, repeated items, modals, and framed tools, not every section by default.
- Risk is visible: destructive actions, secret changes, remote access, and diagnostics need clear confirmation.
- Density with scanability: compact layouts are welcome, but text, icons, and controls must remain easy to locate.
- Internationalized from the start: all visible copy must use i18n keys for `zh-CN`, `zh-TW`, `en`, and `ru`.

## Accessibility Needs

- Keyboard-reachable controls, dialogs, sheets, command palette, and navigation.
- Visible focus states and semantic buttons, forms, tables, and status regions.
- Color must never be the only signal for warning, danger, success, or unsupported backend behavior.
- Text must not overflow controls in English, Simplified Chinese, Traditional Chinese, or Russian.
- Motion should communicate state and remain short, predictable, and non-essential.
