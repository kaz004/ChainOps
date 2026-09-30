import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withQuery, withRoute } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";
import { incidentListQuerySchema } from "@/server/services/incident-service";

export const dynamic = "force-dynamic";

export const GET = withQuery(incidentListQuerySchema, (query) => {
  const incidents = getContainer().incidentService.search(query);
  return ok(incidents, { total: incidents.length });
});

export const POST = withRoute(z.object({ action: z.literal("detect") }), () => {
  const result = getContainer().incidentService.detectFromSignals();
  return ok(result, { total: result.incidents.length });
});
