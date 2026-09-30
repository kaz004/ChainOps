import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withRoute } from "@/lib/api/with-route";
import { resetDemoEnvironment } from "@/server/container";

export const dynamic = "force-dynamic";

const emptyBody = z.object({}).optional();

export const POST = withRoute(emptyBody, async () => {
  resetDemoEnvironment();
  return ok({ reset: true, mode: "simulation" });
});
