# ChainOps AI — Roadmap

Statuses reflect the actual repository as of this writing. Completed phases are marked
**COMPLETED** only where the code proves it; everything else is planned, not built.
The original product specification lives in `docs/00-spec-analysis.md` …
`docs/05-roadmap-and-risks.md`.

---

## Phase 1 — Foundation — COMPLETED

Application shell (sidebar, topbar, mobile drawer, ⌘K/Ctrl-K command palette), dark-first
design-token system with light theme, UI primitives, TypeScript domain models, deterministic
seeded demo dataset, in-memory repositories, simulation engine skeleton (virtual clock, seeded
PRNG, failure registry), Dashboard, Projects list/detail, Settings with demo reset, API
foundation (envelope + route wrappers), tests for state machines / SLO math / PRNG.

## Phase 2 — Project Management — COMPLETED

Full Project domain: create/edit/archive/restore, list with search + status/environment
filters, summary cards (SLO health, incidents, latest deployment), tabbed project detail
(Overview + Activity functional, others polished placeholders), forms with React Hook Form +
Zod, API routes (GET/POST/PATCH/archive/restore), project-scoped activity, tests.

## Phase 3 — Repository Analyzer — COMPLETED

`RepositoryAnalyzer` port + `MockRepositoryAnalyzer` (deterministic demo metadata; all seven
reliability checks), `AnalysisJob` entity + repository, `AnalysisService` with simulated
6-stage pipeline (settled on read), API routes, Analysis tab with provenance banner
("Demo Analysis"), progress polling, full results view, tests.

## Phase 4 — Deployment Engine — COMPLETED

- **Delivered:** validated create/list/detail/action APIs; deterministic `MockDeploymentProvider`
  with settle-on-read step progression, controlled demo failures, canary weights, structured logs,
  cancellation, retry, rollback, and transition activity; deployment center with filters, creation
  controls and live detail updates. Dashboard rows and active counts settle through the service.
- **Simulation boundary:** no repository, build service, or infrastructure is contacted. Demo
  failures are an explicit optional input.
- **Tests:** deterministic provider progression and injected-failure tests; full Vitest suite passes.

## Phase 5 — CI/CD Pipeline — COMPLETED

- **Delivered:** run/stage models and state machines; deterministic 11-stage progression,
  failure injection, cancellation and failed-stage retry; run history/detail APIs and UI; a
  successful Production stage creates a linked simulated deployment.
- **Tests:** stage ordering, deployment linkage, failure, retry and cancellation are covered by
  deterministic service tests.

## Phase 6 — Observability — COMPLETED

- **Delivered:** `TelemetryProvider` port + simulated adapter sampling the shared deterministic
  engine at five-minute boundaries; RED/utilization metrics, health summaries, trace-linked
  structured logs, expandable span trees, service/time/severity/search filters and bounded
  log pagination. `/api/observability` validates query filters and labels results as
  `demo-telemetry`.
- **Boundary:** demo telemetry only; no external collector or infrastructure connection.
- **Tests:** deterministic sample/correlation, filters and page-size validation covered.

## Phase 7 — SLO & Error Budgets — COMPLETED

## Phase 7 — SLO & Error Budgets

**Delivered:** telemetry-derived request-weighted availability/success and latency SLI, SLO
list/detail UI, budget/burn visualizations, `/api/slos`, and a typed Production deployment
policy check for breached objectives or >14.4× 1h burn. The UI identifies the six-hour
simulated observation window; no persisted 30-day history is claimed. Tests cover weighted SLI,
zero/missing traffic, latency threshold, invalid target/window, budget math and policy blocking.

## Phase 8 — Incident Management

- **Delivered:** alert model/store with the seeded firing alert linked to `INC-142`, deduplicating
  detection from SLO telemetry, incident list filters, detail correlation (alerts, SLOs, metrics,
  logs, traces, deployments, pipeline runs), explicit state transitions, and alert resolution
  with incident resolution.
- **Boundary:** detection and telemetry are simulated; no autonomous mitigation or external
  infrastructure operation. Evidence comes from the current simulated telemetry snapshot.
- **Tests:** alert creation/deduplication, incident correlation, valid/invalid transitions and
  resolution behavior are covered.

## Phase 9 — Chaos Engineering — COMPLETED

- **Delivered:** nine allowlisted fault types, bounded duration/intensity, target and blast-radius
  checks, explicit confirmation for production-labeled demo targets, one active run, abort/expiry
  cleanup, run history/results, and incident promotion. Fault modifiers feed shared metrics,
  health and traces, then SLO evaluation and alert/incident detection.
- **Boundary:** deterministic simulated faults only; no real infrastructure operation. The
  simulation engine clears expired effects even when no page is polling.
- **Tests:** state transitions, production confirmation, telemetry-to-SLO-to-incident promotion,
  abort restoration and expiry cleanup.

## Phase 10 — AI Operations — COMPLETED

- **Delivered:** `AIProvider` port + deterministic `MockAIProvider`; repository analysis reuses
  the provider through its existing analyzer port; incident RCA/summarization, deployment risk
  estimates, and structured postmortem drafts use supplied platform evidence. The AI Ops and
  detail pages show confidence/evidence and label all output as Demo AI.
- **Safety:** advisory only; no provider method executes actions or exposes hidden reasoning.
  Failed and insufficient-evidence states have explicit structured results.
- **Tests:** known RPC failure, ambiguous incident, insufficient evidence, adapter failure,
  repository analysis, deployment risk, and postmortem structure are covered.

## Phase 11 — Policy & Remediation — COMPLETED

**Delivered:** typed `PolicyEngine`, `RemediationService`, `RemediationProvider` port and
simulated provider for service restart records, RPC failover/provider disable, and failed
deployment rollback. Proposed→approved/rejected→executing→succeeded/failed transitions are
table-driven, role/risk gated, verified and audit logged. Arbitrary fields/actions are rejected.

**Safety boundary:** AI output is not executable and never auto-creates remediation. The demo
API uses the seeded owner principal because real authentication is not implemented; the UI/docs
state this explicitly. This role simulation is not a production security boundary.

**Tests:** disallowed actions, malformed input, invalid targets, missing approval, role checks,
valid execution, provider failure, verification and audit events are covered.

## Phase 12 — Multichain Infrastructure

- **Status: COMPLETED.** Added a `ChainProvider` port and deterministic simulated adapter for
  Ethereum, Polygon, Base, and Arbitrum. Snapshots include advancing block height, block time,
  seeded gas estimates, weighted RPC latency/error rates, provider status, and `demo-chain`
  provenance.
- Replaced the Chains placeholder with Chain Center and provider traffic/health detail. Degraded
  provider actions link to a preselected Phase 11 remediation proposal; failover requires policy
  checks and explicit approval. The adapter drains the provider, redistributes traffic
  proportionally across healthy peers, clears its simulated failure, and never contacts RPC.
- Chain failures feed simulated service telemetry and SLO evaluation. RCA consumes chain status;
  verified remediation is followed by recovered telemetry/SLO and incident resolution.
- **Tests:** deterministic chain coverage, failover weights and failure clearing, plus an
  end-to-end RPC degradation → telemetry/SLO → RCA → approved failover → recovery → resolution /
  postmortem workflow.
- **Limitations:** gas estimates and provider metrics are seeded demonstrations, block heights
  advance in process, and no real chain/RPC integration, durable history, or authentication exists.
