import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withParams, withParamsAndBody } from "@/lib/api/with-route";
import { startAnalysisSchema } from "@/server/services/analysis-service";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().min(1).max(80) });

/** POST /api/projects/:id/analysis — start an analysis job. */
export const POST = withParamsAndBody<typeof startAnalysisSchema, { id: string }>(
  paramsSchema,
  startAnalysisSchema,
  async (input, { params }) => {
    const view = getContainer().analysisService.start(params.id, input, "Adrian Vale");
    return ok(view, undefined, { status: 202 });
  },
);

/** GET /api/projects/:id/analysis — latest job (settled on read). */
export const GET = withParams(async (_req, { params }) => {
  const { id } = paramsSchema.parse(params);
  const view = getContainer().analysisService.latest(id);
  return ok(view);
});
