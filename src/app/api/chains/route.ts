import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withQuery } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

const emptyQuery = z.object({}).passthrough();

export const GET = withQuery(emptyQuery, async () => {
  const chains = getContainer().chainService.list();
  return ok(chains, { total: chains.length });
});
