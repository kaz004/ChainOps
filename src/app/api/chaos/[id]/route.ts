import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withParams, withParamsAndBody } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";

const paramsSchema = z.object({ id: z.string().min(1) });
const actionSchema = z.discriminatedUnion("action", [z.object({ action: z.literal("abort") }), z.object({ action: z.literal("promote") })]);

export const GET = withParams<{ id: string }>(async (_req, { params }) => ok(getContainer().chaosService.get(params.id)));
export const POST = withParamsAndBody<typeof actionSchema, { id: string }>(paramsSchema, actionSchema, (input, { params }) => {
  const service = getContainer().chaosService;
  return ok(input.action === "abort" ? service.abort(params.id) : service.promoteToIncident(params.id));
});
