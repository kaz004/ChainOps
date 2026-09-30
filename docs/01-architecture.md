# ChainOps AI — Architecture & Ports/Adapters

Companions: [00-spec-analysis](00-spec-analysis.md) · [02-domain-and-data-model](02-domain-and-data-model.md) · [03-project-structure](03-project-structure.md) · [04-api-boundaries](04-api-boundaries.md) · [05-roadmap-and-risks](05-roadmap-and-risks.md)

---

## 1. Layered view

```text
┌──────────────────────────────────────────────────────────────────┐
│ UI (Next.js App Router, RSC-first)                               │
│   features/* pages + components (no business logic)              │
├──────────────────────────────────────────────────────────────────┤
│ API layer (route handlers)                                       │
│   validate (Zod) → call service → envelope → errors mapped       │
├──────────────────────────────────────────────────────────────────┤
│ Application services (server/services/*)                         │
│   orchestration, authorization, event emission                   │
├──────────────────────────────────────────────────────────────────┤
│ Domain (server/core/domain/*)                                    │
│   entities, enums, state machines, policies, pure logic          │
├──────────────────────────────────────────────────────────────────┤
│ Ports (server/core/ports/*)                                      │
│   DeploymentProvider · ChainProvider · AIService ·               │
│   MetricsSource · RepositoryAnalyzer · PolicyEngine              │
├──────────────────────────────────────────────────────────────────┤
│ Adapters (server/adapters/*)                                     │
│   simulated/*  (v0)         real/*  (future: k8s, eth, llm)      │
├──────────────────────────────────────────────────────────────────┤
│ Persistence ports (server/core/repositories/*)                   │
│   one interface per aggregate, in-memory impl in v0              │
└──────────────────────────────────────────────────────────────────┘
                     │
            SimulationEngine (singleton, virtual clock, seeded PRNG)
```

Key rule: **UI → services only; services → ports only; the container wires adapters.**
Nothing in `features/` or `components/` imports from `server/adapters/*`.

## 2. Ports (real domain boundaries only)

| Port | Methods (contract summary) | Simulated adapter (v0) | Future adapters |
|---|---|---|---|
| `DeploymentProvider` | `plan(input)`, `execute(deployment)` → step events, `rollback(deployment)`, `getCanaryState(id)` | `SimulatedDeploymentProvider` — deterministic step timeline on the virtual clock | KubernetesDeploymentProvider (Helm + canary) |
| `ChainProvider` | `getChains()`, `getRpcProviders(chainId)`, `injectRpcFailure(providerId, profile)`, `clearFailure(providerId)` | `SimulatedChainProvider` — holds failure state; reports latency/error rate through MetricsSource | Ethereum/Polygon/Base/Arbitrum providers over real RPC |
| `MetricsSource` | `getSeries(metric, range)`, `getSnapshot(serviceId)`, `listAnomalies(since)` | `SimulatedMetricsSource` — generates series from sim state (healthy baseline, deployed, failing) | Prometheus/OTLP |
| `AIService` | `analyzeIncident(incident, evidence)` → `IncidentAnalysis`, `analyzeRepository(repo)` → findings, `assessDeploymentRisk(plan)` → `RiskAssessment`, `draftPostmortem(incident)` → markdown | `HeuristicAIAdapter` — rule-based, evidence-linked, confidence-scored | LLMProvider (OpenAI/Anthropic), same contract |
| `RepositoryAnalyzer` | `analyze(url, ref)` → `RepositoryAnalysis` | `SimulatedRepoAnalyzer` — deterministic profile keyed by repo URL+seed | GitHub tarball + semgrep/etc. |
| `PolicyEngine` | `evaluate(action, context)` → `PolicyDecision { allowed, mode: auto\|require_approval\|blocked, reasons[] }` | `DefaultPolicyEngine` — table-driven rules (burn rate, risk, blast radius, allowlist) | OPA/external |

Ports are **interfaces + Zod schemas**, no implementations, no I/O.

## 3. The simulation engine (the heart)

`server/core/simulation/` — a singleton per server process:

- **Virtual clock**: sim-time = epoch + elapsed × `TIME_SCALE` (60×), sampled lazily on read.
- **Seeded PRNG** per entity: `mulberry32(hash(seed, entityId))` → deterministic jitter.
- **State → metrics causality**: baseline profiles per service/chain; failure injections mutate
  state; series generators read state at time *t*. Nothing random-per-render.
- **Event emission**: state transitions append `DomainEvent`s to the event log (D5).
- **Tick loop** (`setInterval`, guarded): advances active deployments/pipelines/incidents/
  experiments through their phase schedules, checks alert thresholds → creates incidents,
  advances remediation → recovery.

Closed loop wiring:

```text
ChaosLabService.inject(experiment)
  → SimulatedChainProvider.injectRpcFailure()      # state mutates
  → SimulatedMetricsSource reflects it             # metrics move
  → SimEngine tick: AnomalyDetector fires alert
  → IncidentService.createFromAlert()
  → AIService.analyzeIncident() (evidence from MetricsSource + ChainProvider)
  → PolicyEngine.evaluate(RemoveDegradedRpcProvider)
  → mode auto → RemediationService.execute → ChainProvider.clearFailure
  → metrics recover → tick verifies → IncidentService.resolve()
  → AIService.draftPostmortem() (editable draft)
```

Every arrow is a real service call through a port. No UI fakes any arrow.

## 4. API layer conventions

- Route handlers are thin: parse params → `schema.parse(body)` → service call → `ok(data)`.
- `lib/api/response.ts`: `ok()` / `fail(code, message, status)`; global error mapping
  (`AppError` subclasses → HTTP codes); every error carries `requestId` (spec §62).
- `lib/api/handler.ts`: `withRoute(schema, fn)` wraps handlers with validation + error mapping
  + timing.
- Authn/authz: v0 uses a single simulated workspace user; `requireUser()` exists so real
  auth slots in without touching services.

## 5. Client data layer

- TanStack Query with per-domain query keys (`queryKeys.ts`); server components fetch
  directly from services for first paint; client islands poll only what moves
  (dashboard 5s, deployment detail 2s, log tailing on-demand).
- Mutations invalidate precisely (e.g. `rollback` invalidates deployment + activity).

## 6. Persistence strategy (v0 → production path)

- v0: **in-memory repositories** with seeded demo dataset, plus `globalThis` singleton
  guard so hot-reload survives in dev. Reset = re-seed.
- v1 (drop-in): swap repositories to SQLite/Postgres impls behind identical interfaces;
  add Drizzle. Services/domain/adapters do not change.
- Events are append-only; series are generated, not stored (MetricsSource owns them).

## 7. Self-observability (spec §63)

`/api/health` (liveness: uptime, sim mode, version) and `/api/ready` (checks repos seeded,
sim engine ticking). Middleware records API latency/error counts in-memory; surfaced later
in Settings → System.

## 8. Testing strategy

- Unit: state machines (deployment, incident), SLO/error-budget math, policy engine,
  anomaly thresholds, PRNG determinism.
- Integration: the §49 closed loop — inject → detect → RCA → policy → remediate → resolve;
  plus project create and deployment lifecycle, all against in-memory repos + sim engine.
- E2E (Playwright, later phase): spec §60 script.
