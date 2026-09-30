"use client";

import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { useMobileNav } from "@/components/layout/app-shell";
import { CommandPalette } from "@/components/layout/command-palette";
import { cn } from "@/lib/utils";

interface TopbarProps {
  searchItems: { label: string; href: string; group: string }[];
  notifications: { id: string; title: string; body: string; severity: string; read: boolean }[];
}

export function Topbar({ searchItems, notifications }: TopbarProps) {
  const { theme, toggle } = useTheme();
  const { openMobileNav } = useMobileNav();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur lg:px-5">
      <button
        type="button"
        onClick={openMobileNav}
        aria-label="Open navigation menu"
        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Menu aria-hidden className="size-4" />
      </button>

      <CommandPalette items={searchItems}>
        <button
          type="button"
          className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open command palette (Ctrl+K)"
        >
          <Search aria-hidden className="size-3.5" />
          <span className="flex-1 text-left">Search operations, projects, deployments…</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            Ctrl K
          </kbd>
        </button>
      </CommandPalette>

      <div className="ml-auto flex items-center gap-1">
        <NotificationsMenu notifications={notifications} unread={unread} />

        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {theme === "dark" ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
        </button>

        <div
          className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-1 ring-primary/30"
          title="Adrian Vale — owner"
        >
          AV
        </div>
      </div>
    </header>
  );
}

function NotificationsMenu({
  notifications,
  unread,
}: {
  notifications: TopbarProps["notifications"];
  unread: number;
}) {
  return (
    <details className="group relative">
      <summary
        role="button"
        tabIndex={0}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className="flex cursor-pointer list-none rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        <Bell aria-hidden className="size-4" />
        {unread > 0 ? (
          <span aria-hidden className="relative -ml-1 -mt-1 size-2 rounded-full bg-destructive ring-2 ring-background" />
        ) : null}
      </summary>
      <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-popover p-2 shadow-xl">
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Notifications
        </p>
        {notifications.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No notifications</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 6).map((n) => (
              <li key={n.id} className="rounded-md p-2 hover:bg-accent/60">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      n.severity === "critical" ? "bg-destructive" : n.severity === "warning" ? "bg-warning" : "bg-info",
                    )}
                  />
                  <p className="truncate text-xs font-medium">{n.title}</p>
                  {!n.read ? <span className="ml-auto text-[9px] uppercase text-primary">new</span> : null}
                </div>
                <p className="mt-0.5 pl-3.5 text-[11px] text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
