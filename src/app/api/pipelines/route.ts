import { ok } from "@/lib/api/response";
import { createPipelineSchema } from "@/server/services/pipeline-service";
import { getContainer } from "@/server/container";
import { z } from "zod";
import { withRoute } from "@/lib/api/with-route";

export const dynamic = "force-dynamic";

export const GET = withRoute(z.object({}), async () => ok(getContainer().pipelineService.list()));

export const POST = withRoute(createPipelineSchema, async (input) => {
  return ok(getContainer().pipelineService.create(input), undefined, { status: 202 });
});
