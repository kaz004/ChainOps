# ChainOps AI — Domain Model & Data Model

Companions: [00-spec-analysis](00-spec-analysis.md) · [01-architecture](01-architecture.md) · [03-project-structure](03-project-structure.md) · [04-api-boundaries](04-api-boundaries.md) · [05-roadmap-and-risks](05-roadmap-and-risks.md)

---

## 1. Conventions

- **IDs:** internal `id` (uuid) + **business ID** (`DEP-1042`, `INC-142`, `PRJ-7`) from per-type
  monotonic counters; UI/API expose business IDs (copyable).
- **Timestamps:** `createdAt`/`updatedAt` (ISO 8601 UTC) on every entity; event-sourced views
  derive times from the event log.
- **Enums:** exhaustive string unions (not `string`); one source in `types/domain.ts`.
- **Money/metrics:** numbers in SI units (ms, %, req/min); UI formats centrally in `lib/format.ts`.

## 2. Entity catalog

| Entity | Key fields (abridged) | Relationships |
|---|---|---|
| `Workspace` | name, plan, mode (`demo`) | 1→N users, projects |
| `User` | name, email, role (`owner`/`admin`/`engineer`/`viewer`) | belongs to workspace |
| `Project` | businessId, name, slug, description, repoUrl, owner, status (`active`/`archived`) | 1→N services, deployments, slos |
| `Service` | businessId, name, kind (`api`/`worker`/`frontend`/`contract`), tier (`tier-1`/`tier-2`), project | 1→N deployments, SLOs |
| `Environment` | name (`production`/`staging`/`dev`), project | scoping for deployments, SLOs |
| `Deployment` | businessId, project, service, version, gitSha, env, status (state machine §3), trigger (`manual`/`pipeline`/`auto-rollback`), steps[], canaryState | belongs to service + env |
| `DeploymentStep` | name, status, startedAt, endedAt, logs | ordered in deployment |
| `Pipeline` / `PipelineStage` | businessId, deployment, stages[] with `stageStatus` | belongs to deployment |
| `RepositoryAnalysis` | repo, commit, languages, frameworks, services, infra (docker/k8s/terraform/helm/ci), security findings, reliability findings, recommendations[] | linked to project |
| `Incident` | businessId, title, severity (`sev-1..4`), status (state machine §3), services[], detectedAt, resolvedAt, impact, analysis, remediations[] | 1→N events, 1→1 postmortem |
| `IncidentEvent` | at, kind (`detection`/`alert`/`status-change`/`ai-analysis`/`action`/`mitigation`/`resolution`), message, actor (`system`/`ai`/user), refs | append-only |
| `SLO` | businessId, service, env, kind (`availability`/`latency`/`error-rate`), target, window (`30d`), sli (query def), alerts[] | belongs to service |
| `ErrorBudget` | computed view: remainingPct, consumedPct, burnRate (1h/6h), projectedExhaustion | derived, not stored |
| `ChaosExperiment` | businessId, type (`pod-failure`/`rpc-failure`/`network-latency`/`packet-loss`/`cpu-stress`/`memory-pressure`/`db-failure`/`traffic-spike`/`deployment-regression`), target, intensity, durationSec, blastRadius, safetyPolicy, status (`draft`/`running`/`completed`/`aborted`/`failed-safety`) | 1→N runs |
| `ChaosRun` | businessId, experiment, startedAt, detectionSec, mitigationSec, recoverySec, peakErrorRate, finalErrorRate, sloImpactPct, timeline[], status | 1→0..1 incident |
| `Chain` | businessId, network (`ethereum`/`polygon`/`base`/`arbitrum`), chainId, blockHeight, blockTimeMs, status | 1→N rpc providers |
| `RpcProvider` | name, endpointClass, weight, status (`healthy`/`degraded`/`down`), latencyP50/P95, errorRate | belongs to chain |
| `Runbook` | businessId, title, triggerType, sections (`symptoms`/`detection`/`diagnosis`/`actions`/`verification`/`rollback`/`escalation`), markdown | editable |
| `Postmortem` | businessId, incident, status (`draft`/`review`/`published`), sections per spec §34, author | 1→1 incident |
| `AIAnalysis` | kind (`incident-rca`/`repo-analysis`/`deploy-risk`/`anomaly`/`capacity`), confidence (`low`/`medium`/`high`), hypothesis, evidence[], recommendations[], status (`complete`/`pending`/`failed`) | attached to subject |
| `RemediationAction` | businessId, incident, actionId (allowlist), title, risk (`low`/`medium`/`high`), mode (`auto`/`require_approval`/`blocked`), status (`proposed`/`approved`/`rejected`/`executing`/`executed`/`failed`), verification | policy-gated |
| `Alert` | businessId, kind (`latency`/`error-rate`/`saturation`/`budget-burn`), subject, threshold, observed, severity, state (`firing`/`resolved`), incidentId | 1→0..1 incident |
| `Anomaly` | metric, subject, expectedRange, observed, deviationPct, detectedAt, incidentId | derived from MetricsSource |
| `Notification` | kind, title, body, subjectRef, severity, readAt | user-scoped |
| `ActivityEvent` / `DomainEvent` | id, at, kind, actor, subjectType/Id, summary, refs | append-only spine |

## 3. State machines (pure functions in `server/core/domain/state-machines.ts`)

```text
DeploymentStatus: queued → running → canary → verifying → success
                  queued/running → failed
                  failed → rollback_pending → rolling_back → rolled_back
                  canary → cancelled (pause)
IncidentStatus:   detected → investigating → mitigating → monitoring → resolved
                  any active → resolved; resolved → postmortem_created (derived flag)
ChaosRunStatus:   pending → running → completed | aborted | failed_safety
RemediationStatus: proposed → approved → executing → executed | failed
                   proposed → rejected
```

`transition(entity, event)` returns `{ ok, next } | { ok: false, reason }` — invalid
transitions are unrepresentable at the service layer (throw `InvalidTransitionError`).

## 4. Domain event taxonomy (`server/core/events.ts`)

`deployment.*`, `pipeline.*`, `incident.*`, `alert.*`, `anomaly.*`, `chaos.*`,
`remediation.*`, `slo.budget_warning`, `chain.provider_status_changed`, `ai.analysis_completed`,
`postmortem.created`, `project.*`, `activity.*` — every event: `{ id, at, kind, actor, subject, summary, refs }`.
Subscribers: activity feed, notifications, incident timeline, sim engine hooks.

## 5. Persistence shape

- In-memory `Map`-based repositories per aggregate root with `list(filter)/get(id)/insert/save/delete`
  + `nextBusinessId(prefix)`. Seeded once per process via `seedDemo()`.
- Derived views (ErrorBudget, ActivityFeed, IncidentTimeline, dashboards) are **computed**,
  never stored.
- Swap-in path: Drizzle schema mirrors §2 exactly; repositories become SQL impls; sim engine
  unchanged.

## 6. Demo seed (deterministic, spec §64)

Projects: **GoaPass** (payments, tier-1), **CrossChain Payments**, **Inference Gateway**.
Services: api-gateway, checkout-api, payment-worker, notification-service, rpc-router.
Chains: Ethereum, Polygon, Base, Arbitrum — Base's **rpc-b** seeded `degraded`.
Deployments: mix of success/failed/rolled-back/active-canary. Incidents: one resolved (INC-141),
one active SEV-2 (INC-142 "Base RPC degradation") with full timeline. SLOs per service with
realistic targets (99.95% availability, p95 < 300ms). Runbooks: RPC failure, DB saturation,
high latency, deployment failure, memory pressure, queue backlog.
