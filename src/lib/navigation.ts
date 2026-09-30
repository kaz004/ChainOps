/**
 * Central navigation registry — plain data only (no icon components), so it
 * is safe to import from both server and client modules. The icon name is
 * resolved against the client-side registry in app-shell.tsx.
 */

export interface NavItem {
  label: string;
  href: string;
  /** Icon registry key (see NAV_ICONS in components/layout/app-shell.tsx). */
  icon: string;
  /** Phase when the section becomes functional (docs/05). */
  phase: number;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: "LayoutDashboard",
    phase: 1,
    description: "Operational health across services, deployments, incidents and chains.",
  },
  {
    label: "Projects",
    href: "/projects",
    icon: "Boxes",
    phase: 1,
    description: "First-class workspaces connecting repositories, services and chains.",
  },
  {
    label: "Deployments",
    href: "/deployments",
    icon: "Rocket",
    phase: 2,
    description: "Deployment center with timelines, canary control and rollbacks.",
  },
  {
    label: "Pipelines",
    href: "/pipelines",
    icon: "GitBranch",
    phase: 2,
    description: "CI/CD pipeline visualization with stage logs.",
  },
  {
    label: "Infrastructure",
    href: "/infrastructure",
    icon: "Layers",
    phase: 3,
    description: "Clusters, nodes, pods and resource optimization.",
  },
  {
    label: "Observability",
    href: "/observability",
    icon: "Activity",
    phase: 3,
    description: "Metrics, logs and traces across services.",
  },
  {
    label: "Incidents",
    href: "/incidents",
    icon: "Siren",
    phase: 4,
    description: "Incident workflow with AI root-cause analysis.",
  },
  {
    label: "SLOs",
    href: "/slos",
    icon: "CircleDot",
    phase: 4,
    description: "Service levels, error budgets and burn-rate policy.",
  },
  {
    label: "Chaos Lab",
    href: "/chaos",
    icon: "FlaskConical",
    phase: 5,
    description: "Controlled failure experiments with safety policies.",
  },
  {
    label: "AI Ops",
    href: "/ai-ops",
    icon: "Sparkles",
    phase: 6,
    description: "Incident RCA, anomaly detection, capacity forecasts.",
  },
  {
    label: "Remediation",
    href: "/remediations",
    icon: "ShieldCheck",
    phase: 11,
    description: "Policy-gated, approval-based simulated recovery actions.",
  },
  {
    label: "Chains",
    href: "/chains",
    icon: "Link2",
    phase: 12,
    description: "Multichain RPC health, provider weights and failover.",
  },
  {
    label: "Runbooks",
    href: "/runbooks",
    icon: "ScrollText",
    phase: 9,
    description: "Editable operational procedures for recurring failure modes.",
  },
  {
    label: "Postmortems",
    href: "/postmortems",
    icon: "GitPullRequest",
    phase: 9,
    description: "Blameless incident analysis and action tracking.",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "Settings",
    phase: 1,
    description: "Workspace, users, environments, integrations and policies.",
  },
];
