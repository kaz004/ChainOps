import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withParams } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().min(1).max(80) });

/** POST /api/projects/:id/restore — return an archived project to active. */
export const POST = withParams(async (_req, { params }) => {
  const { id } = paramsSchema.parse(params);
  const project = getContainer().projectService.restore(id);
  return ok(project);
});
