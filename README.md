<div align="center">

# ChainOps AI

### See the failure. Understand the blast radius. Recover with control.

An operator-focused SRE control plane demo connecting service health, chain RPCs, SLOs,
incidents, evidence-based analysis, and approval-gated recovery.

[Open the walkthrough video](assets/readme/chainops-walkthrough.webm) · [View the recovery workflow](assets/readme/operational-loop.svg)

</div>

> **Demo mode:** service health, chains, telemetry, deployments, and recovery actions use seeded
> simulations. No live infrastructure, RPC endpoint, repository, telemetry collector, or external
> AI provider is contacted.

[![Animated ChainOps walkthrough showing the dashboard, chain health, and incident response](assets/readme/chainops-preview.gif)](assets/readme/chainops-walkthrough.webm)

<sub>Click the preview for the full WebM walkthrough.</sub>

## The operating loop

![Animated diagram of the simulated incident recovery loop](assets/readme/operational-loop.svg)

RPC degradation is reflected in dependent-service telemetry and SLO evaluation. The resulting
evidence informs incident analysis. A failover must be proposed, policy-checked, and approved
before the simulator redistributes traffic and verifies recovery.

## Product tour

| Chain Center | Incident evidence |
| --- | --- |
| ![Chain Center with simulated Ethereum, Polygon, Base, and Arbitrum provider health](assets/readme/chains.png) | ![Incident detail with correlated alerts, telemetry, timeline, and evidence](assets/readme/incident-recovery.png) |

The animated preview cycles through screenshots of the dashboard, Chain Center, and
incident screens. Click it or use the [full WebM walkthrough](assets/readme/chainops-walkthrough.webm)
to open the complete clip. All screens show seeded demo state.

## What is here

**Project status:** a local-first demonstration of the ChainOps incident recovery workflow. The
flows below run end to end against deterministic simulations; they do not operate real systems.

- **Operational overview:** service health, SLO compliance, chain status, deployments, incidents,
  and recent activity.
- **Projects and analysis:** project management and deterministic repository metadata analysis.
- **Delivery:** staged deployment and CI simulations with progress, logs, canary weights, retry,
  cancellation, and rollback flows.
- **Observability and SLOs:** five-minute simulated metric samples, correlated logs/traces,
  service-level indicators, error budgets, and deployment policy checks.
- **Incident response:** alert-to-incident correlation, guarded lifecycle transitions, evidence
  bundles, and postmortem drafts.
- **Chaos Lab:** bounded, allowlisted simulated failures with confirmation and telemetry effects.
- **Chain Center:** simulated Ethereum, Polygon, Base, and Arbitrum health, block progression,
  gas estimates, RPC latency/error rates, and weighted providers.
- **Policy and remediation:** audited, allowlisted proposals requiring approval before simulated
  RPC failover or other supported recovery actions.

## Try the recovery story

1. Start the app and open **Chains**. Base is seeded with a degraded RPC provider.
2. Follow **Propose policy-gated failover** to create a remediation proposal.
3. Approve and execute the proposal in **Remediation**. The simulator shifts traffic to healthy
   peers and clears the injected provider failure.
4. Check **Observability**, **SLOs**, and **Incidents** for the resulting recovery state.

## Run locally

**Requirements:** Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The in-memory demo dataset is restored on
server startup and can be reset from Settings. Changes made during a session do not persist
across a server restart.

## Verify

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

The 107 deterministic tests cover domain state machines, validation, service behavior, simulated
providers, telemetry/SLO/incident integration, remediation policy, and the multichain recovery
workflow. CI also type-checks, lints, and builds the app. Browser-driven end-to-end tests are not
currently included.

## Architecture

```text
App Router UI
    │
    ▼
Validated API routes ─────── Server-rendered service reads
    │                                      │
    ▼                                      ▼
Application services ─────── Composition root (container.ts)
    │
    ▼
Domain + ports
    │
    ├── deterministic simulation engine
    └── in-memory repositories + simulated adapters
```

Services depend on provider ports, not UI components. `src/server/container.ts` wires the
simulated adapters; replacing them with real integrations would still require production-grade
identity, persistence, secrets/configuration, policy enforcement, observability, and deployment
hardening.

## Demo boundaries

- State is held in memory and returns to its seeded baseline when the server restarts.
- User identities and role checks are demo workflow controls, not authentication or authorization.
- Chain/RPC health, telemetry, deployment/CI behavior, analysis, AI results, and remediation are
  simulated; no live infrastructure or external AI service is contacted.

See [Architecture](docs/ARCHITECTURE.md), [Development](docs/DEVELOPMENT.md), and
[Roadmap](docs/ROADMAP.md) for implementation status and engineering details.

## Contributing and license

Run the checks in [Development](docs/DEVELOPMENT.md) before opening a change. GitHub Actions runs
tests, type checking, lint, and a production build on pushes and pull requests. No license file is
included; choose one before publishing if you want to grant reuse rights.
