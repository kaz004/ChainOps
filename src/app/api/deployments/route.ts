import { ok } from "@/lib/api/response";
import { withQuery, withRoute } from "@/lib/api/with-route";
import {
  createDeploymentSchema,
  listDeploymentsQuery,
} from "@/server/services/deployment-service";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

export const GET = withQuery(listDeploymentsQuery, async (query) => {
  const page = getContainer().deploymentService.list(query);
  return ok(page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
  });
});

export const POST = withRoute(createDeploymentSchema, async (input) => {
  const deployment = getContainer().deploymentService.create(input);
  return ok(deployment, undefined, { status: 201 });
});
