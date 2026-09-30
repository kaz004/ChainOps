import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withQuery } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";
export const GET = withQuery(z.object({ id: z.string().optional() }), (query) => {
  const service = getContainer().sloService;
  return ok(query.id ? service.get(query.id) : service.listWithBudgets());
});
