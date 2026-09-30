import { ok } from "@/lib/api/response";
import { withQuery, withRoute } from "@/lib/api/with-route";
import {
  createProjectSchema,
  listProjectsQuery,
} from "@/server/services/project-service";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

export const GET = withQuery(listProjectsQuery, async (query) => {
  const summaries = getContainer().projectService.listSummaries(query);
  return ok(summaries, { total: summaries.length });
});

export const POST = withRoute(createProjectSchema, async (input) => {
  const project = getContainer().projectService.create(input);
  return ok(project, undefined, { status: 201 });
});
