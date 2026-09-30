import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withParams, withParamsAndBody } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";

const paramsSchema = z.object({ id: z.string().min(1).max(80) });
const actionSchema = z.object({ action: z.enum(["cancel", "retry", "rollback"]) });

export const dynamic = "force-dynamic";

export const GET = withParams<{ id: string }>(async (_req, { params }) => {
  return ok(getContainer().deploymentService.get(params.id));
});

export const POST = withParamsAndBody<typeof actionSchema, { id: string }>(
  paramsSchema,
  actionSchema,
  async ({ action }, { params }) => {
    const service = getContainer().deploymentService;
    const deployment = action === "cancel"
      ? service.cancel(params.id)
      : action === "retry"
        ? service.retry(params.id)
        : service.rollback(params.id);
    return ok(deployment, undefined, { status: action === "retry" ? 202 : 200 });
  },
);
