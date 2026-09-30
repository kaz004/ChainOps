import { z } from "zod";
import type {
  ActivityEvent,
  Chain,
  Deployment,
  Incident,
  Project,
  ProjectStatus,
  Service,
  Slo,
} from "@/types/domain";
import { CHAIN_NETWORKS, ENVIRONMENTS } from "@/types/domain";
import {
  InMemoryProjectRepository,
  type ProjectRepository,
} from "@/server/repositories/project-repository";
import { getRepos } from "@/server/repositories/store";
import { nextBusinessId } from "@/server/core/domain/ids";
import { ConflictError, NotFoundError } from "@/server/core/errors";

// ── Validation schemas (docs/04 §3) ───────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(3).max(64),
  description: z.string().min(8).max(280),
  repoUrl: z
    .string()
    .min(4)
    .max(160)
    .regex(/^[\w.-]+\/[\w.-]+$/, "Repository must look like 'owner/repo'"),
  defaultBranch: z.string().min(1).max(80).default("main"),
  ownerName: z.string().min(2).max(64).default("Unassigned"),
  environment: z.enum(ENVIRONMENTS).default("production"),
  chainNetworks: z.array(z.enum(CHAIN_NETWORKS)).min(1),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** Partial update — all fields optional; service applies only provided ones. */
export const updateProjectSchema = z
  .object({
    name: z.string().min(3).max(64).optional(),
    description: z.string().min(8).max(280).optional(),
    repoUrl: z
      .string()
      .min(4)
      .max(160)
      .regex(/^[\w.-]+\/[\w.-]+$/, "Repository must look like 'owner/repo'")
      .optional(),
    defaultBranch: z.string().min(1).max(80).optional(),
    ownerName: z.string().min(2).max(64).optional(),
    environment: z.enum(ENVIRONMENTS).optional(),
    chainNetworks: z.array(z.enum(CHAIN_NETWORKS)).min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listProjectsQuery = z.object({
  q: z.string().max(120).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  environment: z.enum(ENVIRONMENTS).optional(),
  owner: z.string().max(64).optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── View models ───────────────────────────────────────────────────

export interface ProjectSummary {
  project: Project;
  serviceCount: number;
  chainNetworks: Chain["network"][];
  lastDeployment: {
    businessId: string;
    serviceName: string;
    version: string;
    status: Deployment["status"];
    createdAt: string;
  } | null;
  sloHealth: {
    total: number;
    healthy: number;
    /** Worst status across the project's SLOs. */
    status: "healthy" | "at-risk" | "breached" | "none";
  };
  openIncidents: number;
}

export interface SloView {
  slo: Slo;
  budgetRemainingPct: number;
  status: "healthy" | "at-risk" | "breached";
}

export interface ProjectDetailBundle {
  project: Project;
  services: Service[];
  deployments: Deployment[];
  chains: Chain[];
  slos: SloView[];
  incidents: Incident[];
  activity: ActivityEvent[];
}

export interface ProjectDeps {
  /** Defaults to the app-wide in-memory store. */
  projectRepository?: ProjectRepository;
  /** Shares the app's SLO evaluation instead of duplicating budget math. */
  evaluateSlos?: () => SloView[];
}

export class ProjectService {
  private readonly projects: ProjectRepository;
  private readonly evaluateSlos: () => SloView[];

  constructor(deps: ProjectDeps = {}) {
    this.projects = deps.projectRepository ?? new InMemoryProjectRepository();
    this.evaluateSlos = deps.evaluateSlos ?? (() => []);
  }

  // ── Queries ─────────────────────────────────────────────────────

  list(query: ListProjectsQuery = { status: "active" }): Project[] {
    let items = this.projects.all();

    if (query.status !== "all") {
      items = items.filter((p) => p.status === query.status);
    }
    if (query.environment) {
      items = items.filter((p) => p.environment === query.environment);
    }
    if (query.owner) {
      const owner = query.owner.toLowerCase();
      items = items.filter((p) => p.ownerName.toLowerCase().includes(owner));
    }
    if (query.q) {
      const q = query.q.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.repoUrl.toLowerCase().includes(q) ||
          p.businessId.toLowerCase().includes(q),
      );
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** List enriched for cards/tables (spec §13). */
  listSummaries(query: ListProjectsQuery = { status: "active" }): ProjectSummary[] {
    return this.list(query).map((p) => this.buildSummary(p));
  }

  get(idOrSlug: string): Project {
    const found =
      this.projects.getById(idOrSlug) ?? this.projects.getBySlug(idOrSlug);
    if (!found) throw new NotFoundError("Project", idOrSlug);
    return found;
  }

  tryGet(idOrSlug: string): Project | null {
    try {
      return this.get(idOrSlug);
    } catch {
      return null;
    }
  }

  getServicesFor(idOrSlug: string): Service[] {
    const project = this.get(idOrSlug);
    const repos = getRepos();
    return project.serviceIds
      .map((sid) => repos.services.get(sid))
      .filter((s): s is Service => Boolean(s));
  }

  /** Everything the detail page tabs need, in one service call. */
  getDetail(idOrSlug: string): ProjectDetailBundle {
    const repos = getRepos();
    const project = this.get(idOrSlug);
    const services = project.serviceIds
      .map((sid) => repos.services.get(sid))
      .filter((s): s is Service => Boolean(s));
    const serviceIds = new Set(services.map((s) => s.id));

    const deployments = repos.deployments
      .all()
      .filter((d) => d.projectId === project.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const chains = repos.chains
      .all()
      .filter((c) => project.chainIds.includes(c.id))
      .sort((a, b) => a.network.localeCompare(b.network));

    const slos = this.evaluateSlos().filter((v) => serviceIds.has(v.slo.serviceId));

    const incidents = repos.incidents
      .all()
      .filter((i) => i.affectedProjectIds.includes(project.id))
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

    // Seeded events may reference either internal ids or business ids —
    // match case-insensitively against both.
    const deploymentRefs = new Set(deployments.flatMap((d) => [d.id, d.businessId.toLowerCase()]));
    const incidentRefs = new Set(incidents.flatMap((i) => [i.id, i.businessId.toLowerCase()]));
    const activity = repos.activity
      .recent(100)
      .filter(
        (e) =>
          (e.refType === "project" && e.refId === project.id) ||
          (e.refType === "deployment" && e.refId !== null && deploymentRefs.has(e.refId.toLowerCase())) ||
          (e.refType === "incident" && e.refId !== null && incidentRefs.has(e.refId.toLowerCase())),
      )
      .slice(0, 25);

    return { project, services, deployments, chains, slos, incidents, activity };
  }

  // ── Commands ────────────────────────────────────────────────────

  create(input: CreateProjectInput, actor: string = input.ownerName): Project {
    const slug = slugify(input.name);
    if (this.projects.getBySlug(slug)) {
      throw new ConflictError("A project with this name already exists");
    }

    const chainIds = this.resolveChainIds(input.chainNetworks);
    const now = new Date().toISOString();

    const project: Project = {
      id: `prj-${slug}`,
      businessId: nextBusinessId("PRJ"),
      name: input.name,
      slug,
      description: input.description,
      repoUrl: input.repoUrl,
      defaultBranch: input.defaultBranch,
      status: "active",
      environment: input.environment,
      ownerName: input.ownerName,
      serviceIds: [],
      chainIds,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    this.projects.insert(project);
    this.appendActivity(
      project,
      "Project created",
      `${project.name} connected ${project.repoUrl}`,
      actor,
    );
    return project;
  }

  update(idOrSlug: string, input: UpdateProjectInput, actor = "Adrian Vale"): Project {
    const repos = getRepos();
    const project = this.get(idOrSlug);
    const next: Project = { ...project };

    if (input.name !== undefined && input.name !== project.name) {
      const slug = slugify(input.name);
      const clash = this.projects.getBySlug(slug);
      if (clash && clash.id !== project.id) {
        throw new ConflictError("A project with this name already exists");
      }
      next.name = input.name;
      next.slug = slug;
      next.id = `prj-${slug}`;
    }
    if (input.description !== undefined) next.description = input.description;
    if (input.repoUrl !== undefined) next.repoUrl = input.repoUrl;
    if (input.defaultBranch !== undefined) next.defaultBranch = input.defaultBranch;
    if (input.ownerName !== undefined) next.ownerName = input.ownerName;
    if (input.environment !== undefined) next.environment = input.environment;
    if (input.chainNetworks !== undefined) {
      next.chainIds = this.resolveChainIds(input.chainNetworks);
    }

    next.updatedAt = new Date().toISOString();
    this.projects.save(next);

    // Keep cross-aggregate refs pointing at the (possibly new) project id.
    if (next.id !== project.id) {
      for (const d of repos.deployments.all()) {
        if (d.projectId === project.id) repos.deployments.save({ ...d, projectId: next.id });
      }
      for (const i of repos.incidents.all()) {
        if (i.affectedProjectIds.includes(project.id)) {
          repos.incidents.save({
            ...i,
            affectedProjectIds: i.affectedProjectIds.map((id) =>
              id === project.id ? next.id : id,
            ),
          });
        }
      }
      repos.activity.append({
        id: `act-${crypto.randomUUID()}`,
        at: next.updatedAt,
        kind: "project",
        title: "Project renamed",
        detail: `${project.name} is now ${next.name}`,
        refType: "project",
        refId: next.id,
        actor,
      });
    }

    this.appendActivity(next, "Project updated", describeChanges(project, next), actor);
    return next;
  }

  archive(idOrSlug: string, actor = "Adrian Vale"): Project {
    return this.setStatus(idOrSlug, "archived", actor);
  }

  restore(idOrSlug: string, actor = "Adrian Vale"): Project {
    return this.setStatus(idOrSlug, "active", actor);
  }

  // ── Internals ───────────────────────────────────────────────────

  private setStatus(idOrSlug: string, status: ProjectStatus, actor: string): Project {
    const project = this.get(idOrSlug);
    if (project.status === status) {
      throw new ConflictError(`Project is already ${status}`);
    }
    const next: Project = {
      ...project,
      status,
      archivedAt: status === "archived" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    this.projects.save(next);
    this.appendActivity(
      next,
      status === "archived" ? "Project archived" : "Project restored",
      status === "archived"
        ? `${next.name} was archived; deployments become read-only`
        : `${next.name} was restored to active`,
      actor,
    );
    return next;
  }

  private resolveChainIds(networks: Chain["network"][]): string[] {
    const chainByNetwork = new Map(getRepos().chains.all().map((c) => [c.network, c.id]));
    return networks
      .map((n) => chainByNetwork.get(n))
      .filter((id): id is string => Boolean(id));
  }

  private buildSummary(p: Project): ProjectSummary {
    const repos = getRepos();
    const services = p.serviceIds
      .map((sid) => repos.services.get(sid))
      .filter((s): s is Service => Boolean(s));
    const serviceIds = new Set(services.map((s) => s.id));

    const last = repos.deployments
      .all()
      .filter((d) => d.projectId === p.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    const chains = p.chainIds
      .map((cid) => repos.chains.get(cid))
      .filter((c): c is Chain => Boolean(c));

    const sloViews = this.evaluateSlos().filter((v) => serviceIds.has(v.slo.serviceId));
    const rank = { breached: 3, "at-risk": 2, healthy: 1 } as const;
    const worst = sloViews.reduce<"healthy" | "at-risk" | "breached" | "none">((acc, v) => {
      if (acc === "none" || rank[v.status] > rank[acc]) return v.status;
      return acc;
    }, "none");

    const openIncidents = repos.incidents.all().filter(
      (i) => i.affectedProjectIds.includes(p.id) && i.status !== "resolved",
    ).length;

    return {
      project: p,
      serviceCount: services.length,
      chainNetworks: chains.map((c) => c.network),
      lastDeployment: last
        ? {
            businessId: last.businessId,
            serviceName: last.serviceName,
            version: last.version,
            status: last.status,
            createdAt: last.createdAt,
          }
        : null,
      sloHealth: {
        total: sloViews.length,
        healthy: sloViews.filter((v) => v.status === "healthy").length,
        status: worst,
      },
      openIncidents,
    };
  }

  private appendActivity(
    project: Project,
    title: string,
    detail: string,
    actor: string,
  ): void {
    getRepos().activity.append({
      id: `act-${crypto.randomUUID()}`,
      at: new Date().toISOString(),
      kind: "project",
      title,
      detail,
      refType: "project",
      refId: project.id,
      actor,
    });
  }
}

function describeChanges(before: Project, after: Project): string {
  const changes: string[] = [];
  if (before.description !== after.description) changes.push("description");
  if (before.repoUrl !== after.repoUrl) changes.push("repository");
  if (before.defaultBranch !== after.defaultBranch) changes.push("branch");
  if (before.environment !== after.environment) changes.push("environment");
  if (before.ownerName !== after.ownerName) changes.push("owner");
  if (before.chainIds.join() !== after.chainIds.join()) changes.push("chains");
  return changes.length > 0 ? `Updated ${changes.join(", ")}` : "Metadata updated";
}
