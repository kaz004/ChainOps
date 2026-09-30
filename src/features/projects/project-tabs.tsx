import Link from "next/link";
import { cn } from "@/lib/utils";

export const PROJECT_TABS = [
  "Overview",
  "Analysis",
  "Deployments",
  "Infrastructure",
  "Observability",
  "SLOs",
  "Chains",
  "Incidents",
  "Chaos",
  "Activity",
  "Settings",
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number];

/** Functional tabs in Phase 3 (docs/05); others render polished placeholders. */
export const FUNCTIONAL_TABS: ProjectTab[] = ["Overview", "Analysis", "Activity"];

interface ProjectTabsProps {
  slug: string;
  active: ProjectTab;
}

/**
 * URL-driven tabs (`?tab=`): server-rendered links keep the detail page a
 * Server Component — no client state needed for navigation.
 */
export function ProjectTabs({ slug, active }: ProjectTabsProps) {
  const base = `/projects/${slug}`;
  return (
    <div role="tablist" aria-label="Project sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {PROJECT_TABS.map((tab) => {
        const functional = FUNCTIONAL_TABS.includes(tab);
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            href={`${base}?tab=${tab.toLowerCase()}`}
            className={cn(
              "relative whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}
            {!functional ? (
              <span className="ml-1 rounded border border-border px-1 text-[9px] uppercase text-muted-foreground" title="Planned for a later phase">
                soon
              </span>
            ) : null}
            {isActive ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" /> : null}
          </Link>
        );
      })}
    </div>
  );
}

export function parseTab(value: string | undefined): ProjectTab {
  const found = PROJECT_TABS.find((t) => t.toLowerCase() === value);
  return found ?? "Overview";
}
