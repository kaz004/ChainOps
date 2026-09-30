# ChainOps AI — Development Guide

How to work on this repository. Only commands that exist in
[package.json](../package.json) are documented here.

## Requirements

- **Node.js 22** (developed on v22.14.0; Next.js 15 requires >= 18.18)
- **npm** (11.x used; there is a `package-lock.json` — commit it with dependency changes)
- No database, no Docker, no external services required.

## Installation

```bash
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server (http://localhost:3000). In-memory seed is created on first request. |
| `npm run build` | Production build (`next build`). Runs type checking and route validation. |
| `npm run start` | Serve the production build (run `npm run build` first). |
| `npm run lint` | ESLint 9 flat config over the whole repo (`eslint .`). |
| `npm test` | Run all Vitest tests once (`vitest run`). |
| `npm run test:watch` | Run Vitest in watch mode (`vitest`). |
| `npx tsc --noEmit` | Type-check only (no `typecheck` npm script exists — use tsc directly). |

Recommended pre-handoff gate (all four must be green):

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

GitHub Actions runs these checks and `npm run build` for pushes and pull requests.

## Environment configuration

- **There are no environment variables.** `process.env` is not read anywhere in `src/`
  (the only exception is `process.env.TZ = "UTC"` inside `tests/setup.ts`). No `.env*`
  files are needed or present.
- If a future phase adds env config, add a Zod-validated module and document it here.

## Database setup

**Not applicable.** There is no database, ORM, or migration tool. Persistence is a
process-wide in-memory store (see "Seed & demo data"). A future persistence phase should
introduce a repository-port implementation (e.g. SQL/Drizzle) behind the existing
`ProjectRepository` / `AnalysisJobRepository` interfaces rather than changing service code.

## Seed & demo data

- The demo dataset is deterministic: fixed epoch `T0 = 2026-09-30T12:00:00Z`, seeded PRNG,
  no `Math.random` ([src/server/seed/demo-data.ts](../src/server/seed/demo-data.ts)).
- Seeding happens when the store singleton is first created in the server process. Business-ID
  counters are restored from `COUNTER_SEED` so new IDs continue after the seed.
- **All state is lost when the server restarts.**
- `POST /api/demo/reset` (or Settings → "Reset demo data" in the UI) re-seeds everything
  and resets ID counters. Use it whenever the demo looks inconsistent.

## Local development workflow

1. `npm run dev`, open http://localhost:3000 (redirects to `/dashboard`).
2. The app shell includes a command palette (⌘K), theme toggle (dark-first), and toast system.
3. Useful flows: Projects (create/edit/archive), project detail → Analysis tab (staged
   analysis simulation, ~1.5 s per stage), Settings → demo reset.
4. When the simulation behaves oddly, check `GET /api/health` (liveness + engine tick) and
   `GET /api/ready` (seeded check).

## Debugging approach

- **Server-side logic:** start in the services ([src/server/services/](../src/server/services/));
  they own all business logic. Repositories and the simulation engine sit below them;
  `src/server/container.ts` is the single composition root.
- **API layer:** route handlers are thin; validation/error mapping happens in
  [src/lib/api/with-route.ts](../src/lib/api/with-route.ts). Check the response envelope
  (`ok` / `fail` with error codes `VALIDATION_ERROR | NOT_FOUND | INVALID_TRANSITION |
  POLICY_BLOCKED | CONFLICT | INTERNAL`) when debugging failures.
- **Client interactivity:** feature components under `src/features/` are the only client
  components with data fetching (`analysis-panel`, `project-form`, `archive-controls`).
- There is no debugger config, source maps setup, or logging framework; `console.warn/error`
  are allowed by lint, `console.log` is warned.
- Server restart is a legitimate debugging tool: it wipes in-memory state back to the seed.

## Testing approach

- **Runner:** Vitest 3, node environment, `tests/**/*.test.ts`, setup file
  [tests/setup.ts](../tests/setup.ts) sets `TZ=UTC` for determinism. Path alias `@` → `./src`.
- **Current suite: 15 files / 107 tests**, covering domain logic, services, simulated providers,
  telemetry/SLO/incident behavior, and the multichain remediation recovery loop. There are no
  browser-driven component/E2E tests.
- **Pattern:** unit-test services and domain modules directly; mock the repository store
  module (`vi.mock`) with a `fixtures.reset()` in `beforeEach` so tests are deterministic
  and independent of seed/global state.
- **Expectations for new code:** state machines, budget math, validation and service logic
  must have deterministic tests before or with the feature. Tests must not depend on wall
  clock or execution order.

## Production build process

```bash
npm run build
npm run start   # serves on port 3000 by default
```

- `next build` type-checks and pre-renders routes. Because all data is server-rendered from
  the in-memory store, **each fresh server process starts from the seed dataset**.
- GitHub Actions CI validates changes but does not deploy. There is no Dockerfile or platform
  deployment configuration. The app is a standard Next.js server app; deployment still requires
  a deliberately chosen Node 22 host and an appropriate long-lived process for its in-memory demo
  state. See [Production Readiness](PRODUCTION_READINESS.md) before exposing it to real users.
