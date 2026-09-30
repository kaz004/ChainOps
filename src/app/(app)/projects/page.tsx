import type { Metadata } from "next";
import Link from "next/link";
import { FolderGit2, Plus, Search } from "lucide-react";
import { getContainer } from "@/server/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { listProjectsQuery } from "@/server/services/project-service";
import { formatRelativeTime, formatExactTime } from "@/lib/format";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

const DEPLOY_BADGE: Record<string, "success" | "error" | "info" | "warning"> = {
  success: "success",
  failed: "error",
  canary: "info",
  rolled_back: "warning",
  rolling_back: "warning",
  rollback_pending: "warning",
};

const SLO_BADGE: Record<string, "success" | "warning" | "error" | "default"> = {
  healthy: "success",
  "at-risk": "warning",
  breached: "error",
  none: "default",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const parsed = listProjectsQuery.safeParse({
    q: typeof raw.q === "string" && raw.q.length > 0 ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    environment: typeof raw.environment === "string" ? raw.environment : undefined,
  });
  const query = parsed.success ? parsed.data : { status: "active" as const };

  const container = getContainer();
  const summaries = container.projectService.listSummaries(query);
  const archivedCount = container.projectService.list({ status: "archived" }).length;

  const hasFilters = Boolean(query.q || query.environment || (query.status && query.status !== "active"));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
      <PageHeader
        title="Projects"
        description="Workspaces connecting repositories, services and target chains."
        action={
          <Link
            href="/projects/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus aria-hidden className="size-4" /> New project
          </Link>
        }
      />

      {/* Filters — server-rendered via URL params */}
      <form action="/projects" method="get" className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Search name, description, repo…"
            aria-label="Search projects"
            className="h-9 w-64 rounded-md border border-input bg-card pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          name="status"
          defaultValue={query.status}
          aria-label="Filter by status"
          className="h-9 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="active">Active</option>
          <option value="archived">Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}</option>
          <option value="all">All</option>
        </select>
        <select
          name="environment"
          defaultValue={query.environment ?? ""}
          aria-label="Filter by environment"
          className="h-9 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Any environment</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </select>
        <button
          type="submit"
          className="h-9 rounded-md border border-border px-3 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Apply
        </button>
        {hasFilters ? (
          <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        ) : null}
      </form>

      {summaries.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="No projects match your filters"
            description="Try a different search term, or clear the filters to see all projects."
            action={
              <Link href="/projects" className="text-xs font-medium text-primary hover:underline">
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={FolderGit2}
            title="No projects yet"
            description="Connect a Git repository to analyze the application, generate a deployment plan and start operating it from ChainOps."
            action={
              <Link href="/projects/new" className="text-xs font-medium text-primary hover:underline">
                Create your first project →
              </Link>
            }
          />
        )
      ) : (
        <p className="sr-only" aria-live="polite">
          {summaries.length} project{summaries.length === 1 ? "" : "s"} found
        </p>
      )}

      <div className={summaries.length === 0 ? "mt-2" : "grid gap-3 lg:grid-cols-2 xl:grid-cols-3"}>
        {summaries.map((s) => {
          const p = s.project;
          return (
            <Link key={p.id} href={`/projects/${p.slug}`} className="group focus-visible:outline-none">
              <Card className="h-full transition-colors group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2">
                        <FolderGit2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                        {p.name}
                        {p.status === "archived" ? <Badge variant="default">archived</Badge> : null}
                      </CardTitle>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {p.repoUrl} · {p.defaultBranch}
                      </p>
                    </div>
                    <Badge variant="outline">{p.businessId}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{p.environment}</Badge>
                    {s.chainNetworks.map((n) => (
                      <Badge key={n} variant="info" className="capitalize">{n}</Badge>
                    ))}
                  </div>

                  <dl className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Svcs</dt>
                      <dd className="font-data text-sm font-semibold">{s.serviceCount}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">SLOs</dt>
                      <dd>
                        <Badge variant={SLO_BADGE[s.sloHealth.status]}>
                          {s.sloHealth.total === 0 ? "—" : `${s.sloHealth.healthy}/${s.sloHealth.total}`}
                        </Badge>
                      </dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Incs</dt>
                      <dd className="font-data text-sm font-semibold">
                        {s.openIncidents > 0 ? <span className="text-warning">{s.openIncidents}</span> : "0"}
                      </dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</dt>
                      <dd className="truncate text-xs font-medium" title={p.ownerName}>
                        {p.ownerName.split(" ")[0]}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px]">
                    {s.lastDeployment ? (
                      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <Badge variant={DEPLOY_BADGE[s.lastDeployment.status] ?? "info"}>
                          {s.lastDeployment.version}
                        </Badge>
                        <span title={formatExactTime(s.lastDeployment.createdAt)}>
                          {formatRelativeTime(s.lastDeployment.createdAt)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No deployments yet</span>
                    )}
                    <span className="shrink-0 text-muted-foreground" title={formatExactTime(p.updatedAt)}>
                      upd {formatRelativeTime(p.updatedAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
