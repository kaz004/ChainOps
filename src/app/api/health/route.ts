import { NextResponse } from "next/server";
import { getSimulationEngine } from "@/server/core/simulation/singleton";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const engine = getSimulationEngine();
  return NextResponse.json({
    data: {
      status: "ok",
      mode: "simulation",
      version: "0.1.0",
      engine: engine.status(),
    },
  });
}
