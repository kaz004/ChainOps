# ChainOps AI — Roadmap, Dependencies & Risks

Companions: [00-spec-analysis](00-spec-analysis.md) · [01-architecture](01-architecture.md) · [02-domain-and-data-model](02-domain-and-data-model.md) · [03-project-structure](03-project-structure.md) · [04-api-boundaries](04-api-boundaries.md)

---

## 1. Phased plan (each phase ends runnable; spec §71)

| Phase | Ships | Key deliverables | Definition of done |
|---|---|---|---|
| **1 — Foundations** | Shell, tokens, nav, dashboard, projects | Tooling (Next+TS strict+Tailwind+shadcn+Zod+RHF+TanStack Query+Zustand(min)+vitest); design tokens dark/light; AppShell + responsive nav; command palette (⌘K); seeded in-memory repos; sim engine skeleton + clock/PRNG; Dashboard (health summary, service health, SLO overview, deployments, incidents, chain health, activity); Projects list + detail tabs; Create Project wizard (6 steps, RHF+Zod, backward-safe). | Dashboard renders fully from services; wizard validates each step; no `any`; dark/light consistent. |
| **2 — Delivery** | Repository analysis, deployments, pipelines | SimulatedRepoAnalyzer; Deployment Center (table+filters+pagination); Deployment detail with step timeline+logs; deployment state machine + sim progression; pipeline stage visualization with simulated logs; Deploy button (risk check → create). | Deploy from UI reaches SUCCESS/FAILED deterministically; timeline expandable; rollback path stubbed but typed. |
| **3 — Observability** | Metrics, logs, traces | MetricsSource port + series generator; Metrics tabs (RED+CPU/mem/net/db/queue); Log Explorer (severity/service/search, structured detail, virtualized rows); Trace waterfall with span selection; Service health pages. | Logs paginate/virtualize; trace spans selectable; charts lazy-loaded. |
| **4 — Reliability** | Incidents, SLOs, budgets, alerting | Incident list/detail; incident state machine; alert evaluation in sim tick; SLO center (SLI/SLO/budget/burn/trend); budget-based deploy policy check (burn-rate gate). | Active seeded incident renders timeline from event log; deploy blocked at 4.2x burn in demo. |
| **5 — Chaos** | Chaos Lab | Experiment templates; blast-radius/safety policy checks; deterministic run simulation; results (detection/mitigation/recovery, peak error, SLO impact); promote run → incident. | RPC failure experiment produces metrics change visible in Observability within seconds. |
| **6 — AI Ops** | RCA, repo/deploy-risk analysis, anomalies, capacity | HeuristicAIAdapter; incident RCA panel (evidence+confidence+reasoning evidence expandable); anomaly detection → linked anomalies; deployment risk pre-check; capacity forecast page (labeled estimates). | INC-142 RCA shows evidence list consistent with seeded metrics. |
| **7 — Actuation** | Remediation, policy, canary, rollback | RemediationAction lifecycle; DefaultPolicyEngine (allowlist, burn rate, risk); approve/reject/execute with confirm dialogs; canary compare (stable vs canary) + promote/pause/rollback; rollback state machine completion. | Full §49 closed loop works end-to-end from the UI. |
| **8 — Chains** | Chain center, RPC failover | Chain list + detail (providers, weights, latency history); failover visualization + policy-gated failover action; auto-redistribution simulation. | Degraded provider drains traffic; recovery rebalances per weights. |
| **9 — Knowledge** | Runbooks, postmortems, advanced analytics | Runbook CRUD (structured sections); postmortem draft from incident + AI, editable, publish; capacity/anomaly history; Settings sections; demo reset hardening; E2E spec §60 test. | §60 E2E passes in CI. |

Order rationale: each phase consumes only prior ports; the closed loop's *detection* side
(phases 3–5) is complete before the *actuation* side (6–7), so the loop is never faked.

## 2. Dependency graph (external)

| Dependency | Purpose | Risk |
|---|---|---|
| Next.js 15 (App Router), React 19 | app framework | low |
| TypeScript 5 strict | type safety | low |
| Tailwind CSS 4 | tokens/utilities | low — pin version, verify token format |
| shadcn/ui (Radix) | primitives + a11y baseline | low |
| lucide-react | icons | low |
| Recharts | charts (lazy-loaded) | medium — bundle size; dynamic import only |
| React Hook Form + @hookform/resolvers | wizard/forms | low |
| Zod 4 | validation contracts | low |
| @tanstack/react-query | client data | low |
| zustand | global client state (command palette, toasts, theme) | low |
| vitest + testing-library | unit/integration | low |
| Playwright | E2E (phase 9) | low |
| tsx / @types/* | tooling | low |

No database in v0 (in-memory repos). No LLM/API keys in v0 (heuristic AI). No env secrets.

## 3. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sim engine complexity creep (clock, PRNG, tick loop, causal metrics) | bugs, nondeterminism | Pure functions for series/state; PRNG unit-tested for determinism; single tick loop owns all progression |
| Recharts re-render storms on dashboard | perf (§50) | Charts as isolated client islands fed by stable props; memoized selectors; aggregate `/api/dashboard` payload |
| Log volume in a client-side explorer | perf | Server-side filtering/pagination from the start; virtualization via windowed list |
| Spec breadth vs one-pass quality | abandoned refactor | Phase gates above; no phase starts before prior is runnable and typed |
| Vitest/Next monorepo friction | tooling drag | Single Next app; vitest config colocated; integration tests call services directly (no HTTP) for speed |
| In-memory state lost on serverless restart | demo resets mid-use | v0 targets `next start` (long-lived process) for demo; reset button re-seeds; documented limitation |
| A11y regressions with dense UI | WCAG 2.2 AA | Radix primitives, focus-visible tokens, status = icon+text+color, chart text summaries |
| AI hallucination look | trust | Evidence-linked outputs, confidence labels, "simulated reasoning" caption, policy-gated actions (§25/26/56) |

## 4. What gets built first (and why)

**Phase 1 is the next work item.** Concretely: scaffold Next+TS+Tailwind+shadcn; write
`globals.css` token system; build `AppShell` (sidebar/topbar/responsive drawer/⌘K palette);
implement `types/domain.ts` + state machines + in-memory repos + seed; implement
`SimulationEngine` skeleton (clock, PRNG, tick); wire `/api/dashboard`, `/api/projects`,
`/api/deployments` read paths; build Dashboard + Projects + wizard.

Rationale: the shell and token system de-risk every later screen; the domain + sim skeleton
de-risks the closed loop; the seeded dashboard makes every subsequent phase verifiable
against a stable, believable dataset.
