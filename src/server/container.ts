/**
 * Composition root (docs/01 §1). The only module that wires concrete
 * implementations together. Route handlers and RSC pages resolve services
 * from here — never adapters or repositories directly.
 */

import { DashboardService } from "@/server/services/dashboard-service";
import { ProjectService } from "@/server/services/project-service";
import { DeploymentService } from "@/server/services/deployment-service";
import { IncidentService } from "@/server/services/incident-service";
import { SloService } from "@/server/services/slo-service";
import { ChainService } from "@/server/services/chain-service";
import { NotificationService } from "@/server/services/notification-service";
import { AnalysisService } from "@/server/services/analysis-service";
import { PipelineService } from "@/server/services/pipeline-service";
import { TelemetryService } from "@/server/services/telemetry-service";
import { ChaosService } from "@/server/services/chaos-service";
import { AIService } from "@/server/services/ai-service";
import { MockAIProvider } from "@/server/adapters/simulated/ai-provider";
import { SimulatedTelemetryProvider } from "@/server/adapters/simulated/telemetry-provider";
import { RemediationService } from "@/server/services/remediation-service";
import { RuleBasedPolicyEngine } from "@/server/core/domain/policy";
import { SimulatedRemediationProvider } from "@/server/adapters/simulated/remediation-provider";
import { getSimulationEngine } from "@/server/core/simulation/singleton";
import { getRepos, resetRepos } from "@/server/repositories/store";
import { SimulatedChainProvider } from "@/server/adapters/simulated/chain-provider";

export interface Container {
  dashboardService: DashboardService;
  projectService: ProjectService;
  deploymentService: DeploymentService;
  incidentService: IncidentService;
  sloService: SloService;
  chainService: ChainService;
  notificationService: NotificationService;
  analysisService: AnalysisService;
  pipelineService: PipelineService;
  telemetryService: TelemetryService;
  chaosService: ChaosService;
  aiService: AIService;
  remediationService: RemediationService;
}

function build(): Container {
  // Ensure the demo dataset and simulation engine exist.
  getRepos();
  getSimulationEngine();

  const chainProvider = new SimulatedChainProvider();
  const telemetryProvider = new SimulatedTelemetryProvider(chainProvider);
  const telemetryService = new TelemetryService(telemetryProvider);
  const sloService = new SloService(telemetryProvider);
  const deploymentService = new DeploymentService(undefined, (serviceId) => {
    const risky = sloService.listWithBudgets().filter((s) => s.serviceId === serviceId);
    const blocked = risky.find((s) => s.status === "breached" || s.budget.burnRate1h > 14.4);
    return blocked ? `${blocked.businessId} is ${blocked.status} (1h burn ${blocked.budget.burnRate1h}×).` : null;
  });
  const incidentService = new IncidentService(sloService, telemetryService);
  const chainService = new ChainService(chainProvider);
  const aiProvider = new MockAIProvider();
  const aiService = new AIService(incidentService, deploymentService, sloService, chainService, aiProvider);
  const remediationService = new RemediationService(new RuleBasedPolicyEngine(), new SimulatedRemediationProvider(deploymentService, chainProvider), deploymentService);
  const pipelineService = new PipelineService(deploymentService);
  const projectService = new ProjectService({
    // Share the store's seeded repository so all services see one dataset.
    projectRepository: getRepos().projects,
    evaluateSlos: () =>
      sloService.listWithBudgets().map((s) => ({
        slo: s,
        budgetRemainingPct: s.budget.remainingPct,
        status: s.status,
      })),
  });

  return {
    dashboardService: new DashboardService(
      () => sloService.listWithBudgets(),
      () => deploymentService.list({ page: 1, pageSize: 100 }).items,
    ),
    projectService,
    deploymentService,
    incidentService,
    sloService,
    chainService,
    notificationService: new NotificationService(),
    analysisService: new AnalysisService(aiProvider),
    pipelineService,
    telemetryService,
    chaosService: new ChaosService(incidentService),
    aiService,
    remediationService,
  };
}

const globalContainer = globalThis as unknown as { __chainopsContainer?: Container };

export function getContainer(): Container {
  if (!globalContainer.__chainopsContainer) {
    globalContainer.__chainopsContainer = build();
  }
  return globalContainer.__chainopsContainer;
}

export function resetDemoEnvironment(): void {
  resetRepos();
  const engine = getSimulationEngine();
  engine.stop();
  delete (globalThis as unknown as { __chainopsEngine?: unknown }).__chainopsEngine;
  delete (globalThis as unknown as { __chainopsContainer?: unknown }).__chainopsContainer;
}
