import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderGit2, Settings } from "lucide-react";
import { getContainer } from "@/server/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Status } from "@/components/ui/status";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime, formatPct } from "@/lib/format";
import { SloStatusBadge } from "@/features/slo/slo-status-badge";
import { ProjectTabs, parseTab } from "@/features/projects/project-tabs";
import { ArchiveControls } from "@/features/projects/archive-controls";
import { ProjectForm } from "@/features/projects/project-form";
import { AnalysisPanel } from "@/features/projects/analysis-panel";
import { EmptyState } from "@/components/feedback/states";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Project ${slug}` };
}

const DEPLOY_BADGE: Record<string, "success" | "error" | "info" | "warning"> = {
  success: "success",
  failed: "error",
  canary: "info",
  rolled_back: "warning",
  rolling_back: "warning",
  rollback_pending: "warning",
};

const ACTIVITY_DOT: Record<string, string> = {
  incident: "bg-destructive",
  deployment: "bg-primary",
  slo: "bg-warning",
  chain: "bg-info",
  project: "bg-success",
};

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const tabValue = await searchParams.then((sp) => (typeof sp.tab === "string" ? sp.tab : undefined));
  const tab = parseTab(tabValue);

  const container = getContainer();
  const detail = container.projectService.getDetail(slug);
  if (!detail) notFound();
  const { project } = detail;

  const showEdit = tab === "Settings";
  const analysisView = tab === "Analysis" ? container.analysisService.latest(slug) : null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-6">
      <PageHeader
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
        title={project.name}
        description={project.description}
        action={
          <div className="flex items-center gap-2">
            {project.status === "archived" ? <Badge variant="default">archived</Badge> : null}
            <Badge variant="outline" className="font-mono">{project.businessId}</Badge>
            <CopyButton value={project.businessId} label="Copy project ID" />
            <ArchiveControls slug={project.slug} projectName={project.name} status={project.status} />
          </div>
        }
      />

      <ProjectTabs slug={project.slug} active={tab} />

      {showEdit ? (
        <SettingsTab
          slug={project.slug}
          defaults={{
            name: project.name,
            description: project.description,
            repoUrl: project.repoUrl,
            defaultBranch: project.defaultBranch,
            ownerName: project.ownerName,
            environment: project.environment,
            chainNetworks: detail.chains.map((c) => c.network),
          }}
        />
      ) : tab === "Activity" ? (
        <ActivityTab detail={detail} />
      ) : tab === "Analysis" ? (
        <AnalysisPanel
          slug={project.slug}
          initial={analysisView}
          canAnalyze={project.status === "active"}
          repoUrl={project.repoUrl}
          defaultBranch={project.defaultBranch}
        />
      ) : tab === "Overview" ? (
        <OverviewTab detail={detail} />
      ) : (
        <TabPlaceholder tab={tab} />
      )}
    </div>
  );
}

// ── Overview (functional) ─────────────────────────────────────────

type Detail = ReturnType<ReturnType<typeof getContainer>["projectService"]["getDetail"]>;

function OverviewTab({ detail }: { detail: Detail }) {
  const { project, services, chains, deployments, slos, incidents } = detail;
  const lastDeployment = deployments[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>{services.length} detected in this workspace</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {services.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-muted-foreground">
                No services detected yet — repository analysis arrives in Phase 2.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Service</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Team</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-[13px]">{s.name}</TableCell>
                      <TableCell><Badge variant="outline">{s.kind}</Badge></TableCell>
                      <TableCell><Badge variant={s.tier === "tier-1" ? "info" : "default"}>{s.tier}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.teamName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Repository</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs">
              <p className="flex items-center gap-2">
                <FolderGit2 aria-hidden className="size-3.5 text-muted-foreground" />
                <span className="font-mono">{project.repoUrl}</span>
                <CopyButton value={project.repoUrl} label="Copy repository" />
              </p>
              <p className="text-muted-foreground">Branch <span className="font-mono text-foreground">{project.defaultBranch}</span></p>
              <p className="text-muted-foreground">Environment <span className="text-foreground">{project.environment}</span></p>
              <p className="text-muted-foreground">Owner <span className="text-foreground">{project.ownerName}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Target chains</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {chains.length === 0 ? (
                <p className="text-xs text-muted-foreground">No chains configured.</p>
              ) : (
                chains.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <span className="text-xs font-medium capitalize">{c.network}</span>
                    <Status status={c.status} dense label={c.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Latest deployment</CardTitle>
            <Link href={`/projects/${project.slug}?tab=Deployments`} className="text-[11px] text-muted-foreground hover:text-primary">
              All deployments
            </Link>
          </CardHeader>
          <CardContent>
            {lastDeployment ? (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Link href={`/deployments/${lastDeployment.businessId}`} className="font-data text-[13px] font-medium hover:text-primary hover:underline">
                  {lastDeployment.businessId}
                </Link>
                <Badge variant={DEPLOY_BADGE[lastDeployment.status] ?? "info"}>{lastDeployment.status.replace(/_/g, " ")}</Badge>
                <span className="text-muted-foreground">
                  {lastDeployment.serviceName} {lastDeployment.version}
                </span>
                <span className="ml-auto text-muted-foreground">{formatRelativeTime(lastDeployment.createdAt)}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No deployments yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>SLO summary</CardTitle>
            <Link href={`/projects/${project.slug}?tab=SLOs`} className="text-[11px] text-muted-foreground hover:text-primary">Details</Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {slos.length === 0 ? (
              <p className="text-xs text-muted-foreground">No SLOs defined yet.</p>
            ) : (
              slos.map((s) => (
                <div key={s.slo.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{s.slo.serviceName} · {s.slo.kind}</p>
                    <p className="text-[10px] text-muted-foreground">
                      target {formatPct(s.slo.targetPct)} · budget {Math.round(s.budgetRemainingPct)}%
                    </p>
                  </div>
                  <SloStatusBadge status={s.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Incidents</CardTitle>
          <Link href={`/projects/${project.slug}?tab=Incidents`} className="text-[11px] text-muted-foreground hover:text-primary">All incidents</Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {incidents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No incidents recorded for this project.</p>
          ) : (
            incidents.slice(0, 4).map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{i.title}</p>
                  <p className="font-data text-[10px] text-muted-foreground">{i.businessId}</p>
                </div>
                <Badge variant={i.status === "resolved" ? "success" : "warning"}>{i.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Activity (functional) ─────────────────────────────────────────

function ActivityTab({ detail }: { detail: Detail }) {
  const { activity } = detail;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project activity</CardTitle>
        <CardDescription>Chronological operational events for this project.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <EmptyState
            icon={FolderGit2}
            title="No activity yet"
            description="Events appear here as the project is created, deployed to and operated."
          />
        ) : (
          <ol className="relative space-y-4 border-l border-border/70 pl-4">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span
                  aria-hidden
                  className={`absolute -left-[21px] top-1 size-2 rounded-full ring-2 ring-background ${ACTIVITY_DOT[a.kind] ?? "bg-muted-foreground/60"}`}
                />
                <div className="flex items-baseline gap-2">
                  <p className="text-xs font-medium">{a.title}</p>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    <span aria-hidden>{formatRelativeTime(a.at)}</span>
                    <span className="sr-only">{new Date(a.at).toISOString()}</span>
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{a.detail}</p>
                <p className="text-[10px] text-muted-foreground">by {a.actor}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ── Settings (functional edit) ────────────────────────────────────

function SettingsTab({
  slug,
  defaults,
}: {
  slug: string;
  defaults: React.ComponentProps<typeof ProjectForm>["defaults"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings aria-hidden className="size-4" /> Project settings
        </CardTitle>
        <CardDescription>
          Rename, re-own or re-target this project. Cross-references (deployments, incidents,
          activity) follow renames automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProjectForm mode="edit" projectSlug={slug} defaults={defaults} />
      </CardContent>
    </Card>
  );
}

// ── Placeholder tabs (polished, honest) ───────────────────────────

const TAB_COPY: Record<string, { when: string; what: string[] }> = {
  Services: {
    when: "Phase 2 — repository analysis",
    what: ["Detected services from repository analysis", "Per-service ownership and tiering", "Health snapshots per service"],
  },
  Deployments: {
    when: "Phase 2 — deployment center",
    what: ["Full deployment history for this project", "Per-deployment step timelines", "Canary and rollback controls"],
  },
  Infrastructure: {
    when: "Phase 3 — infrastructure",
    what: ["Clusters, nodes and workloads for this project", "Resource requests vs actual usage"],
  },
  Observability: {
    when: "Phase 3 — observability",
    what: ["Metrics, logs and traces scoped to this project's services"],
  },
  SLOs: {
    when: "Phase 4 — reliability",
    what: ["SLO targets and error budgets per service", "Burn-rate alerts and policy"],
  },
  Chains: {
    when: "Phase 8 — chain center",
    what: ["RPC provider health for the project's networks", "Traffic weights and failover"],
  },
  Incidents: {
    when: "Phase 4 — incident management",
    what: ["Incident history with AI root-cause analysis"],
  },
  Chaos: {
    when: "Phase 5 — chaos lab",
    what: ["Experiment history against this project's services"],
  },
};

function TabPlaceholder({ tab }: { tab: string }) {
  const copy = TAB_COPY[tab] ?? { when: "a later phase", what: [] };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tab}</CardTitle>
        <Badge variant="info" className="w-fit">{copy.when}</Badge>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1.5">
          {copy.what.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
