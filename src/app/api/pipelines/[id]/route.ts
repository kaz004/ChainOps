import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withParams, withParamsAndBody } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";

const paramsSchema = z.object({ id: z.string().min(1).max(80) });
const actionSchema = z.object({ action: z.enum(["cancel", "retry-failed-stage"]) });

export const dynamic = "force-dynamic";

export const GET = withParams<{ id: string }>(async (_req, { params }) => {
  return ok(getContainer().pipelineService.get(params.id));
});

export const POST = withParamsAndBody<typeof actionSchema, { id: string }>(
  paramsSchema,
  actionSchema,
  async ({ action }, { params }) => {
    const service = getContainer().pipelineService;
    const run = action === "cancel" ? service.cancel(params.id) : service.retryFailedStage(params.id);
    return ok(run, undefined, { status: 202 });
  },
);
