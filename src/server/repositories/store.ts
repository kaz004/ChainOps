/**
 * DataStore — the aggregate root for all in-memory repositories.
 * One instance per process (globalThis guard survives Next dev HMR).
 */

import type {
  Chain,
  Alert,
  ChaosRun,
  Deployment,
  Incident,
  IncidentEvent,
  Notification,
  PipelineRun,
  RemediationAction,
  RpcProvider,
  Service,
  Slo,
  User,
  Workspace,
} from "@/types/domain";
import { InMemoryRepository } from "./in-memory";
import { ActivityStore } from "./activity";
import { InMemoryProjectRepository } from "./project-repository";
import { InMemoryAnalysisJobRepository } from "./analysis-job-repository";
import {
  activity as seedActivity,
  alerts as seedAlerts,
  chains as seedChains,
  deployments as seedDeployments,
  incidentEvents as seedIncidentEvents,
  incidents as seedIncidents,
  initCounters,
  notifications as seedNotifications,
  projects as seedProjects,
  analysisJobs as seedAnalysisJobs,
  rpcProviders as seedRpcProviders,
  services as seedServices,
  slos as seedSlos,
  users as seedUsers,
  workspace as seedWorkspace,
} from "@/server/seed/demo-data";

export interface Repos {
  workspace: Workspace;
  users: User[];
  projects: InMemoryProjectRepository;
  services: InMemoryRepository<Service>;
  deployments: InMemoryRepository<Deployment>;
  incidents: InMemoryRepository<Incident>;
  alerts: InMemoryRepository<Alert>;
  chaosRuns: InMemoryRepository<ChaosRun>;
  remediations: InMemoryRepository<RemediationAction>;
  incidentEvents: InMemoryRepository<IncidentEvent>;
  slos: InMemoryRepository<Slo>;
  chains: InMemoryRepository<Chain>;
  rpcProviders: InMemoryRepository<RpcProvider>;
  activity: ActivityStore;
  notifications: InMemoryRepository<Notification>;
  analysisJobs: InMemoryAnalysisJobRepository;
  pipelineRuns: InMemoryRepository<PipelineRun>;
}

function buildRepos(): Repos {
  initCounters();

  const projects = new InMemoryProjectRepository(seedProjects);

  const services = new InMemoryRepository<Service>();
  seedServices.forEach((s) => services.insert(s));

  const deployments = new InMemoryRepository<Deployment>();
  seedDeployments.forEach((d) => deployments.insert(d));

  const incidents = new InMemoryRepository<Incident>();
  seedIncidents.forEach((i) => incidents.insert(i));

  const alerts = new InMemoryRepository<Alert>();
  seedAlerts.forEach((alert) => alerts.insert(alert));
  const chaosRuns = new InMemoryRepository<ChaosRun>();
  const remediations = new InMemoryRepository<RemediationAction>();

  const incidentEvents = new InMemoryRepository<IncidentEvent>();
  seedIncidentEvents.forEach((e) => incidentEvents.insert(e));

  const slos = new InMemoryRepository<Slo>();
  seedSlos.forEach((s) => slos.insert(s));

  const chains = new InMemoryRepository<Chain>();
  seedChains.forEach((c) => chains.insert(c));

  const rpcProviders = new InMemoryRepository<RpcProvider>();
  seedRpcProviders.forEach((p) => rpcProviders.insert(p));

  const activity = new ActivityStore();
  seedActivity.forEach((a) => activity.append(a));

  const notifications = new InMemoryRepository<Notification>();
  seedNotifications.forEach((n) => notifications.insert(n));

  const analysisJobs = new InMemoryAnalysisJobRepository(seedAnalysisJobs);
  const pipelineRuns = new InMemoryRepository<PipelineRun>();

  return {
    workspace: seedWorkspace,
    users: seedUsers,
    projects,
    services,
    deployments,
    incidents,
    alerts,
    chaosRuns,
    remediations,
    incidentEvents,
    slos,
    chains,
    rpcProviders,
    activity,
    notifications,
    analysisJobs,
    pipelineRuns,
  };
}

const globalStore = globalThis as unknown as { __chainopsStore?: Repos };

export function getRepos(): Repos {
  if (!globalStore.__chainopsStore) {
    globalStore.__chainopsStore = buildRepos();
  }
  return globalStore.__chainopsStore;
}

/** Full demo reset (spec §47). Re-seeds every repository. */
export function resetRepos(): void {
  globalStore.__chainopsStore = buildRepos();
}
