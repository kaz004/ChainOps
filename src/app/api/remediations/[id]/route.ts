import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withParams, withParamsAndBody } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";

const paramsSchema = z.object({ id: z.string().min(1) });
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("execute") }),
]);

export const GET = withParams<{ id: string }>(async (_req, { params }) => ok(getContainer().remediationService.get(params.id)));
export const POST = withParamsAndBody<typeof actionSchema, { id: string }>(paramsSchema, actionSchema, (input, { params }) => {
  const service = getContainer().remediationService;
  const actorId = "usr-adrian";
  if (input.action === "approve") return ok(service.approve(params.id, actorId));
  if (input.action === "reject") return ok(service.reject(params.id, actorId));
  return ok(service.execute(params.id, actorId));
});
