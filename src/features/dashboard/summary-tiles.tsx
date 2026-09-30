import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TileTone = "success" | "warning" | "info" | "error";

interface SummaryTilesProps {
  tiles: { label: string; value: string; sub: string; tone: TileTone }[];
}

/** Health-summary tiles (spec §12). Tone pairs with the value, never alone. */
export function SummaryTiles({ tiles }: SummaryTilesProps) {
  return (
    <section aria-label="Health summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <Card key={t.label} className="p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t.label}</p>
          <p
            className={cn(
              "mt-1 font-data text-lg font-semibold leading-none",
              t.tone === "success" && "text-success",
              t.tone === "warning" && "text-warning",
              t.tone === "error" && "text-destructive",
              t.tone === "info" && "text-info",
            )}
          >
            {t.value}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">{t.sub}</p>
        </Card>
      ))}
    </section>
  );
}
