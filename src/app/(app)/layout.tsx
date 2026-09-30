import { NAV_ITEMS } from "@/lib/navigation";
import { ShellFrame } from "@/components/layout/shell-frame";
import { getContainer } from "@/server/container";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const container = getContainer();

  const searchItems = [
    ...NAV_ITEMS.map((n) => ({
      label: n.label,
      href: n.href,
      group: "Navigate",
      keywords: n.description,
    })),
    ...container.projectService.list().map((p) => ({
      label: `${p.name} — ${p.repoUrl}`,
      href: `/projects/${p.slug}`,
      group: "Projects",
      keywords: p.description,
    })),
    ...container.deploymentService.list({ page: 1, pageSize: 50 }).items.map((d) => ({
      label: `${d.businessId} · ${d.serviceName} ${d.version}`,
      href: `/deployments/${d.businessId}`,
      group: "Deployments",
      keywords: `${d.status} ${d.gitSha}`,
    })),
    ...container.incidentService.list().map((i) => ({
      label: `${i.businessId} · ${i.title}`,
      href: `/incidents/${i.businessId}`,
      group: "Incidents",
      keywords: `${i.severity} ${i.status}`,
    })),
  ];

  const notifications = container.notificationService.list().map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    severity: n.severity,
    read: n.readAt !== null,
  }));

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <ShellFrame searchItems={searchItems} notifications={notifications}>
        {children}
      </ShellFrame>
    </>
  );
}
