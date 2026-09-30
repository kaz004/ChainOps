# ChainOps AI — Project Structure

Companions: [00-spec-analysis](00-spec-analysis.md) · [01-architecture](01-architecture.md) · [02-domain-and-data-model](02-domain-and-data-model.md) · [04-api-boundaries](04-api-boundaries.md) · [05-roadmap-and-risks](05-roadmap-and-risks.md)

---

## 1. Top-level layout

```text
chainops/
├── app/                        # Next.js App Router (routes only)
│   ├── (app)/                  # authenticated shell group (sidebar + topbar)
│   │   ├── dashboard/
│   │   ├── projects/           # list, new/, [id]/{overview,deployments,...}
│   │   ├── deployments/        # list, [id]
│   │   ├── pipelines/[id]/
│   │   ├── infrastructure/
│   │   ├── observability/      # metrics, logs, traces, services, infra
│   │   ├── incidents/          # list, [id]
│   │   ├── slos/
│   │   ├── chaos/
│   │   ├── ai-ops/
│   │   ├── chains/             # list, [id]
│   │   ├── runbooks/           # list, [id]
│   │   ├── postmortems/
│   │   ├── activity/
│   │   ├── settings/
│   │   └── layout.tsx
│   ├── (marketing)/            # v0: minimal landing/redirect to dashboard
│   ├── api/                    # route handlers (thin)
│   ├── layout.tsx              # theme provider, fonts
│   └── globals.css             # design tokens (§2)
├── components/                 # design system (generic, domain-agnostic)
│   ├── ui/                     # shadcn/ui primitives
│   ├── charts/                 # LazyChart, Sparkline, LatencyPanel...
│   ├── layout/                 # AppShell, Sidebar, Topbar, CommandPalette
│   └── feedback/               # EmptyState, ErrorState, LoadingSkeleton
├── features/                   # domain-flavored client/RSC composition
│   ├── dashboard/
│   ├── projects/
│   ├── deployments/
│   ├── observability/
│   ├── incidents/
│   ├── slo/
│   ├── chaos/
│   ├── chains/
│   ├── ai-ops/
│   ├── runbooks/
│   ├── postmortems/
│   ├── infrastructure/
│   ├── activity/
│   └── settings/
├── server/                     # NEVER imported by client code
│   ├── core/
│   │   ├── domain/             # entities.ts, enums.ts, state-machines.ts, policies.ts
│   │   ├── ports/              # deployment-provider.ts, chain-provider.ts, ai-service.ts...
│   │   ├── simulation/         # engine.ts, clock.ts, prng.ts, anomaly-detector.ts, series.ts
│   │   ├── events.ts           # DomainEvent types + bus
│   │   └── errors.ts
│   ├── adapters/
│   │   ├── simulated/          # deployment.ts, chain.ts, metrics.ts, ai.ts, repo-analyzer.ts
│   │   └── (real/)             # future integrations
│   ├── repositories/           # in-memory impls + interfaces live in core/ports? (see §3)
│   ├── services/               # deployment-service.ts, incident-service.ts, ...
│   ├── container.ts            # composition root (wires ports ↔ adapters)
│   └── seed/                   # demo dataset builder
├── lib/                        # shared by server+client (no I/O secrets)
│   ├── api/                    # response envelope, withRoute wrapper, client fetcher
│   ├── validation/             # shared Zod schemas (API contracts)
│   ├── format.ts, cn.ts, constants.ts
├── types/                      # public shared types re-exported for client use
├── docs/                       # these architecture docs
├── tests/                      # unit + integration (vitest)
├── e2e/                        # Playwright (later phase)
└── app/api/health, ready       # self-observability
```

## 2. Design tokens (`app/globals.css` + Tailwind config)

CSS variables for `background, surface, surface-elevated, border, text-primary,
text-secondary, muted, success, warning, error, info, accent` with dark (default) and light
palettes; semantic Tailwind mappings (`bg-surface`, `text-status-error`, ...). Status always
renders as `{ icon, label, color }` via `components/ui/status.tsx`.

## 3. Import rules (enforced by review, later by ESLint boundaries)

```text
app/, features/, components/  → lib/, types/, server/services (RSC only)
features/*                    ✗ server/adapters, server/repositories, server/core
server/services               → core/*, ports/*, repositories/*
server/adapters               → ports/*, core/simulation only
lib/api                       → types/, validation/ only
```

The **container** (`server/container.ts`) is the only module that imports both ports and
adapters. Route handlers resolve services from the container; RSC pages may call services
directly for first-paint data (still no adapter imports).

## 4. Component conventions

- One focused component per file; pages compose feature components (spec §57).
- Server Components by default; `"use client"` only for interactivity (filters, charts,
  command palette, forms, polling islands).
- Charts via `components/charts/LazyChart.tsx` (dynamic import, no SSR) with textual
  summaries for a11y.
- Tables: shadcn `DataTable` + server-side pagination/filtering params.

## 5. Naming & idioms

- Files kebab-case; components PascalCase exports; services/classes `XService`; ports
  `XProvider`/`XService` interfaces in `core/ports`.
- Query keys centralized: `lib/api/query-keys.ts` (`['deployments', { env, status }]`).
- Every async UI path has loading/empty/error variants from `components/feedback/*`.
