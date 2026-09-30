"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { isValidElement, cloneElement, useEffect, useState, type ReactElement } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface PaletteItem {
  label: string;
  href: string;
  group: string;
  keywords?: string;
}

interface CommandPaletteProps {
  items: PaletteItem[];
  /** Single element (ideally a button) that opens the palette on click. */
  children: ReactElement<{ onClick?: () => void }>;
}

export function CommandPalette({ items, children }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const trigger = isValidElement(children)
    ? cloneElement(children, { onClick: () => setOpen(true) })
    : children;

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15%] max-w-xl translate-y-0 p-0">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Command label="Command palette" className="overflow-hidden rounded-lg">
            <div className="border-b border-border">
              <Command.Input
                autoFocus
                placeholder="Search pages, projects, deployments, incidents…"
                className="h-12 w-full bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                No results found.
              </Command.Empty>
              {items.map((item) => (
                <Command.Item
                  key={`${item.group}:${item.href}:${item.label}`}
                  value={`${item.label} ${item.keywords ?? ""} ${item.group}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs data-[selected=true]:bg-accent"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.group}</span>
                </Command.Item>
              ))}
            </Command.List>
            <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              <span><kbd className="rounded border border-border px-1">↑↓</kbd> navigate</span>
              <span><kbd className="rounded border border-border px-1">↵</kbd> open</span>
              <span><kbd className="rounded border border-border px-1">esc</kbd> close</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
