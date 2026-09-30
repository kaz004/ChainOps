import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <p className="font-data text-4xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-sm font-semibold">Page not found</h1>
      <p className="max-w-sm text-xs text-muted-foreground">
        The page you requested does not exist in this workspace.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Back to overview
      </Link>
    </div>
  );
}
