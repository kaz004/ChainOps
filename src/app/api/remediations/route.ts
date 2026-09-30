import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withQuery, withRoute } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";
import { proposeRemediationSchema } from "@/server/services/remediation-service";

export const dynamic = "force-dynamic";
export const GET = withQuery(z.object({}), () => ok(getContainer().remediationService.list()));
export const POST = withRoute(proposeRemediationSchema, (input) => ok(getContainer().remediationService.propose(input, "usr-adrian"), undefined, { status: 201 }));
