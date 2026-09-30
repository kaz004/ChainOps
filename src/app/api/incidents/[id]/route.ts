import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withParams, withParamsAndBody } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({ action: z.literal("transition"), status: z.enum(["detected", "investigating", "mitigating", "monitoring", "resolved"]) });

export const GET = withParams<{ id: string }>(async (_req, { params }) => ok(getContainer().incidentService.detail(params.id)));

export const POST = withParamsAndBody<typeof bodySchema, { id: string }>(paramsSchema, bodySchema, (input, { params }) => {
  return ok(getContainer().incidentService.transition(params.id, input.status, "Adrian Vale"));
});
