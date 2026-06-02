# Home Management Center

English | [中文](README_CN.md)

Home Management Center is a companion Web management console for [CLIProxyAPIHome](https://github.com/router-for-me/CLIProxyAPIHome), the credential management, scheduling, and distribution service for CLIProxyAPI. It provides a professional browser-based control plane for service overview, model services, account credentials, client access keys, usage logs, system configuration, and diagnostics.

## Features

- **Dashboard**: service overview, readiness status, model service coverage, credential status, client key status, and suggested actions.
- **Model services**: manage provider keys, inspect configured model services, review model references, and create, edit, or delete model service entries.
- **Account credentials**: manage OAuth and file-backed credentials, upload credential JSON files, import Vertex credentials, edit metadata, query available models, enable, disable, download, and delete credentials.
- **Client access keys**: manage the keys used by downstream clients, including create, edit, replace, delete, copy, masked display, and bulk selection flows.
- **Usage and logs**: inspect API key usage, runtime logs, request error logs, file downloads, and guarded log clearing.
- **System configuration**: edit common settings through a visual workspace or update the full config file with diff preview, validation, reload, save, and replacement warnings.
- **System information**: review runtime version, node state, config summary, diagnostic status, and guarded API call tools.
- **Theme system**: light and dark modes.

## Internationalization

The interface currently supports four languages:

- Simplified Chinese
- Traditional Chinese
- English
- Russian

The display language can follow the browser preference automatically, and it can also be changed manually from the sign-in screen or the top language menu.

## Browser Compatibility

Home Management Center targets modern evergreen browsers and an `ES2020` build output:

- Chrome / Chromium
- Edge
- Firefox
- Safari

Responsive layouts are supported for desktop, tablet, and mobile access. For the best experience, use the latest stable version of your browser. Legacy browsers are not supported.

## Requirements

- Node.js 24 or newer
- Bun 1.3 or newer
- A running [CLIProxyAPIHome](https://github.com/router-for-me/CLIProxyAPIHome) backend for live management data

## Quick Start

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

Open:

```txt
http://localhost:3000
```

## Development

```bash
bun run dev              # start the Rsbuild dev server
bun run routes:generate  # regenerate TanStack Router route tree
bun run typecheck        # run TypeScript checks
bun run lint             # run ESLint
bun run format           # format files
bun run format:check     # check formatting
bun run build            # build production assets
bun run preview          # preview the production build
bun run knip             # check unused files, exports, and dependencies
```

## Tech Stack

- React 19
- TypeScript 5.9
- Rsbuild 2
- TanStack Router
- TanStack Query
- Zustand
- shadcn/ui and Radix primitives
- Tailwind CSS v4
- TanStack Table and TanStack Virtual
- React Hook Form and Zod
- Recharts
- Motion
- i18next and react-i18next
- Axios
- Sonner
- cmdk
- Vaul
- next-themes

## Security Notes

- Treat the management key as sensitive.
- Prefer local or private-network management access.
- Use HTTPS and strict server-side access control for remote management.
- Do not expose a management endpoint publicly without understanding its authentication and network restrictions.
- Browser storage is not a secret vault. Use a dedicated browser profile or private environment for sensitive operations when needed.

## FAQ

### Is this the backend service?

No. This repository contains the frontend console. It requires a running CLIProxyAPIHome backend to provide management data and perform management operations.

### Does this project proxy model requests?

No. Model request forwarding is handled by the backend service. This project only provides the browser-based management interface.

### Can I use it with a remote backend?

Yes, if the backend enables remote management and is protected by appropriate network, HTTPS, and authentication settings.

## Documentation

- `PRODUCT.md`: product positioning, users, product jobs, and UX principles.
- `DESIGN.md`: visual system, layout principles, component behavior, and UI quality rules.
- `AGENTS.md`: coding-agent guidance for working in this repository.
- `CLAUDE.md`: Claude Code guidance aligned with `AGENTS.md`.

## Contributing

Issues and pull requests are welcome.

For bug reports, please include:

- Backend version.
- Browser and operating system.
- Reproduction steps.
- Screenshots or screen recordings for UI issues.
- Console or network error details when relevant.

For pull requests, please include:

- A concise description of the change.
- Screenshots for visible UI changes.
- Notes about backend API compatibility.
- Verification commands you ran, such as:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run build
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
