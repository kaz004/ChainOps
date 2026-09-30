import Link from "next/link";
import { SearchX } from "lucide-react";

export function NotFoundCard({ title = "Not found", message, backHref, backLabel }: {
  title?: string;
  message: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-border bg-card p-8 text-center">
      <div aria-hidden className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-5" />
      </div>
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <Link
        href={backHref}
        className="mt-4 inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {backLabel}
      </Link>
    </div>
  );
}
