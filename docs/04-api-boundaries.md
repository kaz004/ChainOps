# ChainOps AI — API Boundaries

Companions: [00-spec-analysis](00-spec-analysis.md) · [01-architecture](01-architecture.md) · [02-domain-and-data-model](02-domain-and-data-model.md) · [03-project-structure](03-project-structure.md) · [05-roadmap-and-risks](05-roadmap-and-risks.md)

---

## 1. Envelope & errors

Success: `{ "data": T, "meta"?: { page, pageSize, total, generatedAt } }`
Failure: `{ "error": { "code": ErrorCode, "message": string, "requestId" } }` (spec §62).

Error codes (initial set): `VALIDATION_ERROR`, `NOT_FOUND`, `INVALID_TRANSITION`,
`POLICY_BLOCKED`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`. Zod issues map to
`VALIDATION_ERROR` with `details[]`; nothing internal leaks.

## 2. Endpoints by module (v0 surface)

```text
# Dashboard / Activity
GET   /api/dashboard                       # one aggregate payload (no widget calls)
GET   /api/activity?cursor=

# Projects
GET   /api/projects                        ?status=&q=&page=
POST  /api/projects                        # CreateProjectInput (multi-step wizard payload)
GET   /api/projects/:id
PATCH /api/projects/:id
DELETE /api/projects/:id                   # dangerous → confirm dialog client-side
GET   /api/projects/:id/analysis           # RepositoryAnalysis
POST  /api/projects/:id/analysis           # re-run analyzer
GET   /api/projects/:id/services

# Deployments & Pipelines
GET   /api/deployments                     ?project=&env=&status=&page=
POST  /api/deployments                     # creates QUEUED; sim engine progresses it
GET   /api/deployments/:id                 # incl. steps, canary state, pipeline
POST  /api/deployments/:id/rollback        # dangerous
POST  /api/deployments/:id/canary          # { action: promote | pause | abort }
GET   /api/deployments/:id/logs?step=

# Incidents
GET   /api/incidents                       ?status=&severity=&service=&page=
GET   /api/incidents/:id                   # incl. events, metrics snapshot, alerts
POST  /api/incidents/:id/acknowledge       # detected → investigating
POST  /api/incidents/:id/status            # guarded by state machine
GET   /api/incidents/:id/analysis
POST  /api/incidents/:id/analyze           # AI RCA (evidence-linked)

# Remediation
GET   /api/remediation?incident=
POST  /api/remediation/:id/approve         # policy → execute
POST  /api/remediation/:id/reject
POST  /api/remediation/:id/execute         # only when policy mode = require_approval

# SLOs
GET   /api/slos                            ?service=&env=
POST  /api/slos
GET   /api/slos/:id                        # incl. budget, burn, history
GET   /api/slos/:id/budget

# Observability
GET   /api/metrics?query=&range=           # series via MetricsSource port
GET   /api/logs?service=&severity=&q=&range=&cursor=
GET   /api/logs/:id                        # structured detail
GET   /api/traces?service=&range=&minDuration=
GET   /api/traces/:id                      # waterfall spans
GET   /api/services/:id/health             # RED/USE snapshot
GET   /api/infrastructure                  # clusters, nodes, pods inventory
GET   /api/infrastructure/nodes/:id

# Chaos
GET   /api/chaos/experiments
POST  /api/chaos/experiments               # create draft (typed templates)
POST  /api/chaos/experiments/:id/start
POST  /api/chaos/experiments/:id/abort     # dangerous
GET   /api/chaos/experiments/:id           # incl. latest run + timeline
POST  /api/chaos/runs/:id/incident         # promote experiment finding to incident

# Chains
GET   /api/chains                          # incl. provider health summary
GET   /api/chains/:id                      # providers, weights, latency history
POST  /api/chains/:id/providers/:pid/failover   # policy-gated, dangerous

# AI Ops
POST  /api/ai/analyze-repository           # { repoUrl } → analysis job result
POST  /api/ai/analyze-incident             # { incidentId }
POST  /api/ai/deployment-risk              # { deploymentPlan } → RiskAssessment
POST  /api/ai/draft-postmortem             # { incidentId } → editable draft
GET   /api/ai/recommendations
GET   /api/ai/capacity-forecast

# Runbooks / Postmortems / Notifications
GET   /api/runbooks  ·  GET/PATCH /api/runbooks/:id
GET   /api/postmortems · GET/PATCH /api/postmortems/:id
GET   /api/notifications · POST /api/notifications/read

# Search / System
GET   /api/search?q=                       # federated: projects, services, deployments,
                                           # incidents, chains, runbooks, logs(sample)
GET   /api/health   ·  GET /api/ready
POST  /api/demo/reset                      # Reset Demo Environment (confirm dialog)
```

## 3. Handler pattern

```ts
// app/api/deployments/route.ts  (illustrative)
export const GET = withRoute(
  listDeploymentsQuery,                       // Zod schema for query params
  async (query, { req }) => ok(container.deploymentService.list(query)),
);
export const POST = withRoute(
  createDeploymentSchema,
  async (body) => ok(await container.deploymentService.create(body)),
);
```

`withRoute` owns: param validation, `requestId` generation, error mapping, timing metric.
Services own authorization, orchestration, event emission, and state-machine invocation.

## 4. Versioning & future Go extraction

Paths are unversioned in v0 (`/api/...`); the envelope and error contract are the version.
When services move to Go, route handlers become thin proxies with identical payloads, and
`server/container.ts` swaps in HTTP adapters for each port — the frontend does not change.
