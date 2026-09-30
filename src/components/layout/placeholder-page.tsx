import { ArrowRight, Construction } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlaceholderPageProps {
  title: string;
  phase: number;
  description: string;
  planned: string[];
  related: { label: string; href: string }[];
}

/**
 * High-quality placeholder for sections landing in later phases (per user
 * instruction: only Overview, Projects and shell are functional in Phase 1).
 * Explains the section's purpose and what will ship.
 */
export function PlaceholderPage({ title, phase, description, planned, related }: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-6">
      <PageHeader
        title={title}
        description={description}
        action={<Badge variant="info">Phase {phase} · planned</Badge>}
      />
      <Card>
        <CardContent className="flex flex-col gap-4 py-6">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="flex size-9 items-center justify-center rounded-md bg-warning/10 text-warning">
              <Construction className="size-4" />
            </span>
            <p className="text-sm font-semibold">Scheduled for Phase {phase}</p>
          </div>
          <div>
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">What this section will do</CardTitle>
            <ul className="mt-2 flex flex-col gap-1.5">
              {planned.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ArrowRight aria-hidden className="mt-0.5 size-3 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <CardDescription>
            ChainOps AI is built phase by phase with a working system at every step — see
            the simulation banner: all data in this environment is demo/simulation data.
          </CardDescription>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {related.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
