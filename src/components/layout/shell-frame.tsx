import { NAV_ITEMS } from "@/lib/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Topbar } from "@/components/layout/topbar";
import { ToastViewport } from "@/components/ui/toast";

interface ShellFrameProps {
  searchItems: { label: string; href: string; group: string }[];
  notifications: { id: string; title: string; body: string; severity: string; read: boolean }[];
  children: React.ReactNode;
}

/**
 * ShellFrame is a server component: it resolves navigation + notification
 * data on the server and renders the interactive AppShell/Topbar around the
 * server-rendered page content. Only plain data crosses the RSC boundary.
 */
export function ShellFrame({ searchItems, notifications, children }: ShellFrameProps) {
  return (
    <>
      <AppShell
        items={NAV_ITEMS}
        topbar={<Topbar searchItems={searchItems} notifications={notifications} />}
      >
        {children}
      </AppShell>
      <ToastViewport />
    </>
  );
}
