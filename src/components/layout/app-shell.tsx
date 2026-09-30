"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  CircleDot,
  ShieldCheck,
  FlaskConical,
  GitBranch,
  GitPullRequest,
  Layers,
  LayoutDashboard,
  Link2,
  Rocket,
  ScrollText,
  Settings,
  Siren,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";

/**
 * Icon registry lives here (client) — icon components must not cross the
 * RSC boundary; NAV_ITEMS carries only the registry key.
 */
const NAV_ICONS: Record<string, LucideIcon> = {
  Activity,
  Boxes,
  CircleDot,
  ShieldCheck,
  FlaskConical,
  GitBranch,
  GitPullRequest,
  Layers,
  LayoutDashboard,
  Link2,
  Rocket,
  ScrollText,
  Settings,
  Siren,
  Sparkles,
};

/**
 * Mobile-nav open callback. Provided by AppShell so client components like
 * Topbar can trigger the drawer WITHOUT receiving function props from
 * server components (not serializable).
 */
const MobileNavContext = createContext<{ openMobileNav: () => void }>({
  openMobileNav: () => {},
});

export function useMobileNav() {
  return useContext(MobileNavContext);
}

export interface AppShellProps {
  items: readonly NavItem[];
  /** Client component tree (e.g. Topbar); rendered inside the nav context. */
  topbar: React.ReactNode;
  children: React.ReactNode;
}

/**
 * AppShell — responsive navigation chrome. Page content (`children`) is
 * server-rendered; only interactive nav state is client-side.
 */
export function AppShell({ items, topbar, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const navLinks = (onNavigate?: () => void) => (
    <nav aria-label="Primary" className="flex flex-col gap-0.5 p-2">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon] ?? CircleDot;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.phase > 1 ? (
              <span
                title={`Planned for phase ${item.phase}`}
                className="ml-auto rounded border border-border px-1 text-[9px] uppercase tracking-wide text-muted-foreground"
              >
                P{item.phase}
                <span className="sr-only"> (planned)</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <MobileNavContext.Provider value={{ openMobileNav: () => setMobileOpen(true) }}>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card/50 lg:flex">
          <SidebarHeader />
          <div className="flex-1 overflow-y-auto">{navLinks()}</div>
          <SidebarFooter />
        </aside>

        {/* Mobile drawer — Radix Dialog for focus trap + escape + a11y */}
        <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 lg:hidden" />
            <DialogPrimitive.Content
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card animate-fade-up lg:hidden"
              aria-describedby={undefined}
            >
              <DialogPrimitive.Title className="sr-only">Navigation menu</DialogPrimitive.Title>
              <div className="flex h-14 items-center justify-between border-b border-border px-3">
                <SidebarHeader compact />
                <DialogPrimitive.Close
                  aria-label="Close menu"
                  className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-4" />
                </DialogPrimitive.Close>
              </div>
              <div className="flex-1 overflow-y-auto">{navLinks(() => setMobileOpen(false))}</div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <div className="flex min-w-0 flex-1 flex-col">
          {topbar}
          <main id="main" className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}

function SidebarHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", compact ? "" : "px-4")}>
      <div aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Activity className="size-4" />
      </div>
      {!compact ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight">ChainOps AI</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">SRE Control Plane</p>
        </div>
      ) : (
        <p className="truncate text-sm font-semibold tracking-tight">ChainOps AI</p>
      )}
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2 rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
        <span>Simulation mode — demo data</span>
      </div>
    </div>
  );
}
