import { ok } from "@/lib/api/response";
import { withQuery } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";
import { telemetryQuerySchema } from "@/server/services/telemetry-service";

export const dynamic = "force-dynamic";

export const GET = withQuery(telemetryQuerySchema, (query) => {
  const data = getContainer().telemetryService.getExplorer(query);
  return ok(data, { total: data.logCount });
});
