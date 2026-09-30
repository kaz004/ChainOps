import { beforeEach, describe, expect, it } from "vitest";
import { AIService } from "@/server/services/ai-service";
import { MockAIProvider } from "@/server/adapters/simulated/ai-provider";
import type { AIAnalysis, IncidentAIContext } from "@/server/core/ports/ai-provider";
import { IncidentService } from "@/server/services/incident-service";
import { DeploymentService } from "@/server/services/deployment-service";
import { SloService } from "@/server/services/slo-service";
import { TelemetryService } from "@/server/services/telemetry-service";
import { ChainService } from "@/server/services/chain-service";
import { resetRepos } from "@/server/repositories/store";
import { SimulatedTelemetryProvider } from "@/server/adapters/simulated/telemetry-provider";
import { SimulatedChainProvider } from "@/server/adapters/simulated/chain-provider";

function makeService(provider = new MockAIProvider()) {
  const chains = new SimulatedChainProvider();
  const telemetryProvider = new SimulatedTelemetryProvider(chains);
  const telemetry = new TelemetryService(telemetryProvider);
  const slos = new SloService(telemetryProvider);
  const incidents = new IncidentService(slos, telemetry);
  return new AIService(incidents, new DeploymentService(), slos, new ChainService(chains), provider);
}

describe("MockAIProvider and AIService", () => {
  beforeEach(() => resetRepos());

  it("returns deterministic, evidence-linked RCA for a known RPC failure", () => {
    const service = makeService();
    const first = service.analyzeIncident("INC-142");
    expect(first.source).toBe("demo-ai");
    expect(first.likelyCause).toContain("RPC provider");
    expect(first.evidence.length).toBeGreaterThan(0);
    expect(first).toEqual(service.analyzeIncident("INC-142"));
  });

  it("keeps ambiguous incidents cautious and assesses deployment risk from linked signals", () => {
    const service = makeService();
    const analysis = service.analyzeIncident("INC-141");
    expect(analysis.likelyCause).not.toContain("confirmed");
    const risk = service.assessDeployment("DEP-1042");
    expect(risk.source).toBe("demo-ai");
    expect(risk.evidence.length).toBeGreaterThan(0);
  });

  it("reports insufficient evidence without inventing a cause", () => {
    const provider = new MockAIProvider();
    const context: IncidentAIContext = {
      incident: { id: "inc-empty", businessId: "INC-EMPTY", title: "Unknown", severity: "sev-4", status: "detected", serviceIds: [], affectedProjectIds: [], detectedAt: new Date(0).toISOString(), resolvedAt: null, summary: "", impact: "" },
      events: [], metrics: [], logs: [], traces: [], slos: [], deployments: [], pipelines: [], chains: [],
    };
    const analysis = provider.analyzeIncident(context);
    expect(analysis.status).toBe("insufficient-evidence");
    expect(analysis.confidence).toBeLessThan(0.2);
    expect(analysis.evidence).toHaveLength(0);
  });

  it("returns a structured failed-analysis result and a demo repository analysis", () => {
    class FailingProvider extends MockAIProvider {
      override analyzeIncident(): AIAnalysis { throw new Error("adapter failure"); }
    }
    const service = makeService(new FailingProvider());
    expect(service.analyzeIncident("INC-142").status).toBe("failed");
    const repository = new MockAIProvider().analyze({ repoUrl: "github.com/acme/goapass", ref: "main", targetChains: ["base"], projectSlug: "goapass" });
    expect(repository.source).toBe("demo-analysis");
  });

  it("generates a structured postmortem from the incident evidence", () => {
    const postmortem = makeService().incidentBundle("INC-142").postmortem;
    expect(postmortem?.source).toBe("demo-ai");
    expect(postmortem?.evidence.length).toBeGreaterThan(0);
    expect(postmortem?.rootCause).toContain("RPC");
  });
});
