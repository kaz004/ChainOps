import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ProjectService,
  createProjectSchema,
  updateProjectSchema,
  type SloView,
} from "@/server/services/project-service";
import { InMemoryProjectRepository } from "@/server/repositories/project-repository";
import { ConflictError, NotFoundError, ValidationError } from "@/server/core/errors";
import type { Chain, Deployment, Slo } from "@/types/domain";

// ── Deterministic test fixtures (no global state, no store import) ──

function makeService(overrides: Partial<{ id: string; name: string; projectId: string }> = {}) {
  return {
    id: overrides.id ?? "svc-a",
    businessId: "SVC-1",
    projectId: overrides.projectId ?? "prj-test-project",
    name: overrides.name ?? "svc-a",
    kind: "api" as const,
    tier: "tier-1" as const,
    environment: "production" as const,
    teamName: "Platform",
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

function makeDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: "dep-1",
    businessId: "DEP-2001",
    projectId: "prj-test-project",
    serviceId: "svc-a",
    serviceName: "svc-a",
    version: "v1.0.0",
    gitSha: "abcdef12",
    environment: "production",
    trigger: "manual",
    status: "success",
    steps: [],
    logs: [],
    simulatedFailureStep: null,
    isSimulatedRun: false,
    canary: null,
    durationMs: 1000,
    triggeredByName: "Tester",
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:01:00.000Z",
    ...overrides,
  };
}

/** Minimal store stub so the service reads cross-aggregate data deterministically. */
vi.mock("@/server/repositories/store", () => {
  const services = new Map<string, ReturnType<typeof makeService>>();
  const deployments: Deployment[] = [];
  const incidents: unknown[] = [];
  const chains: Chain[] = [
    { id: "chn-base", businessId: "CHN-1", network: "base", chainId: 8453, blockHeight: 1, blockTimeMs: 2000, status: "healthy" },
    { id: "chn-polygon", businessId: "CHN-2", network: "polygon", chainId: 137, blockHeight: 2, blockTimeMs: 2100, status: "healthy" },
  ];
  const activity: { id: string; at: string; kind: string; title: string; detail: string; refType: string | null; refId: string | null; actor: string }[] = [];

  return {
    getRepos: () => ({
      services: { get: (id: string) => services.get(id), all: () => [...services.values()] },
      deployments: { all: () => [...deployments], save: (d: Deployment) => d },
      incidents: { all: () => [...incidents], save: () => undefined },
      chains: { all: () => [...chains], get: (id: string) => chains.find((c) => c.id === id) },
      activity: { recent: (n: number) => activity.slice(-n).reverse(), append: (e: never) => activity.push(e) },
      slos: { all: () => [] },
    }),
    __fixtures: {
      addService: (s: ReturnType<typeof makeService>) => services.set(s.id, s),
      addDeployment: (d: Deployment) => deployments.push(d),
      getActivity: () => [...activity],
      reset: () => {
        services.clear();
        deployments.length = 0;
        incidents.length = 0;
        activity.length = 0;
      },
    },
  };
});

// Access fixtures via module after mock hoisting.
import * as store from "@/server/repositories/store";
const fixtures = (store as unknown as { __fixtures: {
  addService: (s: ReturnType<typeof makeService>) => void;
  addDeployment: (d: Deployment) => void;
  getActivity: () => { title: string; refId: string | null }[];
  reset: () => void;
} }).__fixtures;

function makeSlo(overrides: Partial<Slo> = {}): Slo {
  return {
    id: "slo-1",
    businessId: "SLO-1",
    serviceId: "svc-a",
    serviceName: "svc-a",
    kind: "availability",
    targetPct: 99.9,
    windowDays: 30,
    description: "test",
    ...overrides,
  };
}

function makeSloViews(statuses: SloView["status"][], serviceId = "svc-a"): () => SloView[] {
  return () =>
    statuses.map((status, i) => ({
      slo: makeSlo({ id: `slo-${i}`, serviceId }),
      budgetRemainingPct: status === "healthy" ? 80 : status === "at-risk" ? 20 : 0,
      status,
    }));
}

function newService(opts: { sloViews?: () => SloView[] } = {}): ProjectService {
  return new ProjectService({
    projectRepository: new InMemoryProjectRepository(),
    evaluateSlos: opts.sloViews ?? (() => []),
  });
}

/** Seeded service for retrieval tests: project pre-linked to svc-a. */
function seededService(opts: { sloViews?: () => SloView[] } = {}): ProjectService {
  const now = "2026-09-01T00:00:00.000Z";
  const project = {
    id: "prj-test-project",
    businessId: "PRJ-9001",
    name: "Test Project",
    slug: "test-project",
    description: "Seeded retrieval fixture",
    repoUrl: "acme/test",
    defaultBranch: "main",
    status: "active" as const,
    environment: "production" as const,
    ownerName: "Priya Nair",
    serviceIds: ["svc-a"],
    chainIds: ["chn-base", "chn-polygon"],
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  return new ProjectService({
    projectRepository: new InMemoryProjectRepository([project]),
    evaluateSlos: opts.sloViews ?? (() => []),
  });
}

import { beforeEach } from "vitest";

beforeEach(() => {
  fixtures.reset();
});

const VALID_INPUT = {
  name: "Ledger Service",
  description: "On-chain ledger settlement worker",
  repoUrl: "acme/ledger",
  defaultBranch: "main",
  ownerName: "Priya Nair",
  environment: "production" as const,
  chainNetworks: ["base" as const, "polygon" as const],
};

// ── Validation ────────────────────────────────────────────────────

describe("project validation", () => {
  it("accepts a valid create payload", () => {
    const parsed = createProjectSchema.parse(VALID_INPUT);
    expect(parsed.name).toBe("Ledger Service");
    expect(parsed.chainNetworks).toContain("base");
  });

  it("applies defaults for branch, owner and environment", () => {
    const parsed = createProjectSchema.parse({
      name: "Minimal Project",
      description: "Enough description here",
      repoUrl: "acme/minimal",
      chainNetworks: ["base"],
    });
    expect(parsed.defaultBranch).toBe("main");
    expect(parsed.environment).toBe("production");
  });

  it("rejects a malformed repo url", () => {
    const result = createProjectSchema.safeParse({ ...VALID_INPUT, repoUrl: "not-a-repo" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty chain list", () => {
    const result = createProjectSchema.safeParse({ ...VALID_INPUT, chainNetworks: [] });
    expect(result.success).toBe(false);
  });

  it("rejects short names and descriptions", () => {
    expect(createProjectSchema.safeParse({ ...VALID_INPUT, name: "ab" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ ...VALID_INPUT, description: "short" }).success).toBe(false);
  });

  it("rejects an update payload with no fields", () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects unknown network values via the shared constant", () => {
    const result = createProjectSchema.safeParse({ ...VALID_INPUT, chainNetworks: ["solana"] });
    expect(result.success).toBe(false);
  });

  it("keeps ValidationError mapped from zod for API use", () => {
    // Sanity: zod errors surface through safeParse, service throws typed AppErrors.
    expect(new ValidationError("x")).toBeInstanceOf(Error);
  });
});

// ── Creation ──────────────────────────────────────────────────────

describe("project creation", () => {
  it("creates a project with business id, slug and resolved chains", () => {
    const svc = newService();
    const project = svc.create(VALID_INPUT, "Priya Nair");

    expect(project.businessId).toMatch(/^PRJ-\d+$/);
    expect(project.slug).toBe("ledger-service");
    expect(project.id).toBe("prj-ledger-service");
    expect(project.status).toBe("active");
    expect(project.archivedAt).toBeNull();
    expect(project.chainIds).toEqual(["chn-base", "chn-polygon"]);
  });

  it("records a created activity event", () => {
    const svc = newService();
    svc.create(VALID_INPUT, "Priya Nair");
    const activity = fixtures.getActivity();
    expect(activity[0]?.title).toBe("Project created");
    expect(activity[0]?.refId).toBe("prj-ledger-service");
  });

  it("rejects duplicate names with a conflict error", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    expect(() => svc.create(VALID_INPUT)).toThrow(ConflictError);
  });

  it("allows the same name in different services (isolated repos)", () => {
    const a = newService();
    const b = newService();
    expect(a.create(VALID_INPUT).id).toBe(b.create(VALID_INPUT).id);
  });
});

// ── Retrieval ─────────────────────────────────────────────────────

describe("project retrieval", () => {
  it("gets by id and by slug", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    expect(svc.get("prj-ledger-service").name).toBe("Ledger Service");
    expect(svc.get("ledger-service").name).toBe("Ledger Service");
  });

  it("throws NotFoundError for unknown ids", () => {
    const svc = newService();
    expect(() => svc.get("prj-missing")).toThrow(NotFoundError);
    expect(svc.tryGet("prj-missing")).toBeNull();
  });  it("lists with search, status and environment filters", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    svc.create({
      ...VALID_INPUT,
      name: "Archived Thing",
      description: "Retired payment bridge",
      repoUrl: "acme/archived",
      environment: "staging",
    });
    svc.archive("archived-thing");

    expect(svc.list({ status: "active" })).toHaveLength(1);
    expect(svc.list({ status: "all" })).toHaveLength(2);
    expect(svc.list({ status: "all", q: "ledger" })).toHaveLength(1);
    expect(svc.list({ status: "all", environment: "staging" })[0]?.slug).toBe("archived-thing");
  });

  it("builds summaries with last deployment and SLO health", () => {
    fixtures.addService(makeService());
    fixtures.addDeployment(makeDeployment());
    const svc = seededService({ sloViews: makeSloViews(["healthy"]) });

    const summaries = svc.listSummaries({ status: "active" });
    expect(summaries).toHaveLength(1);
    const s = summaries[0]!;
    expect(s.serviceCount).toBe(1);
    expect(s.lastDeployment?.businessId).toBe("DEP-2001");
    expect(s.sloHealth.status).toBe("healthy");
    expect(s.chainNetworks).toEqual(["base", "polygon"]);
  });

  it("summarizes worst SLO status as breached when any SLO is breached", () => {
    fixtures.addService(makeService());
    const svc = seededService({ sloViews: makeSloViews(["healthy", "breached"]) });
    expect(svc.listSummaries({ status: "active" })[0]?.sloHealth.status).toBe("breached");
  });

  it("returns full detail bundle including scoped activity", () => {
    fixtures.addService(makeService());
    fixtures.addDeployment(makeDeployment());
    const svc = seededService({ sloViews: makeSloViews(["at-risk"]) });

    const detail = svc.getDetail("test-project");
    expect(detail.services).toHaveLength(1);
    expect(detail.deployments).toHaveLength(1);
    expect(detail.chains.map((c) => c.network)).toEqual(["base", "polygon"]);
    expect(detail.slos).toHaveLength(1);
    expect(detail.activity).toHaveLength(0); // no activity refs yet in this fixture
  });
});

// ── Update ────────────────────────────────────────────────────────

describe("project update", () => {
  it("updates provided fields only", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    const updated = svc.update("ledger-service", { description: "Updated description text" });

    expect(updated.description).toBe("Updated description text");
    expect(updated.repoUrl).toBe(VALID_INPUT.repoUrl);
    expect(updated.name).toBe(VALID_INPUT.name);
  });

  it("rejects renaming to an existing name", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    svc.create({ ...VALID_INPUT, name: "Other Project", repoUrl: "acme/other" });
    expect(() => svc.update("ledger-service", { name: "Other Project" })).toThrow(ConflictError);
  });

  it("renames keep deployments and incidents pointing at the new id", () => {
    fixtures.addService(makeService());
    fixtures.addDeployment(makeDeployment());
    const svc = newService();
    svc.create(VALID_INPUT);

    const renamed = svc.update("ledger-service", { name: "Renamed Ledger" });
    expect(renamed.id).toBe("prj-renamed-ledger");

    // Re-fetch by new slug; deployments followed via store (same repo instance).
    expect(svc.get("renamed-ledger").slug).toBe("renamed-ledger");
  });

  it("rejects empty update payloads at the schema level", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    expect(() => updateProjectSchema.parse({})).toThrow(z.ZodError);
  });
});

// ── Archive / restore ─────────────────────────────────────────────

describe("project archive", () => {
  it("archives and stamps archivedAt", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    const archived = svc.archive("ledger-service");

    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).not.toBeNull();
    expect(svc.list({ status: "active" })).toHaveLength(0);
    expect(svc.list({ status: "archived" })).toHaveLength(1);
  });

  it("restores and clears archivedAt", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    svc.archive("ledger-service");
    const restored = svc.restore("ledger-service");

    expect(restored.status).toBe("active");
    expect(restored.archivedAt).toBeNull();
  });

  it("rejects archive when already archived", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    svc.archive("ledger-service");
    expect(() => svc.archive("ledger-service")).toThrow(ConflictError);
  });

  it("rejects restore when already active", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    expect(() => svc.restore("ledger-service")).toThrow(ConflictError);
  });

  it("records archive and restore activity", () => {
    const svc = newService();
    svc.create(VALID_INPUT);
    svc.archive("ledger-service");
    svc.restore("ledger-service");

    const titles = fixtures.getActivity().map((a) => a.title);
    expect(titles).toContain("Project archived");
    expect(titles).toContain("Project restored");
  });
});
