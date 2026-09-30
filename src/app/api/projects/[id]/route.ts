import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withParams, withParamsAndBody } from "@/lib/api/with-route";
import { updateProjectSchema } from "@/server/services/project-service";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().min(1).max(80) });

/** GET /api/projects/:id — full detail bundle (accepts id or slug). */
export const GET = withParams(async (_req, { params }) => {
  const { id } = paramsSchema.parse(params);
  const detail = getContainer().projectService.getDetail(id);
  return ok(detail);
});

/** PATCH /api/projects/:id — partial update (validated, id or slug). */
export const PATCH = withParamsAndBody<typeof updateProjectSchema, { id: string }>(
  paramsSchema,
  updateProjectSchema,
  async (input, { params }) => {
    const project = getContainer().projectService.update(params.id, input);
    return ok(project);
  },
);
