import type { Metadata } from "next";
import { getContainer } from "@/server/container";
import { ChaosConsole } from "@/features/chaos/chaos-console";
import { telemetryQuerySchema } from "@/server/services/telemetry-service";

export const metadata: Metadata = { title: "Chaos Lab" };
export const dynamic = "force-dynamic";

export default function ChaosPage() {
  const container = getContainer();
  const services = container.telemetryService.getExplorer(telemetryQuerySchema.parse({})).services;
  return <main className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-6"><header className="flex flex-wrap items-end justify-between gap-3 pb-5"><div><h1 className="text-lg font-semibold">Chaos Lab</h1><p className="text-sm text-muted-foreground">Controlled fault injection against the shared simulation</p></div><span className="text-[11px] text-warning">SIMULATED ONLY · no external infrastructure actions</span></header><ChaosConsole services={services.map(({ id, name, environment }) => ({ id, name, environment }))} runs={container.chaosService.list()} /></main>;
}
