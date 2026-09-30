import { z } from "zod";
import { ok } from "@/lib/api/response";
import { withQuery, withRoute } from "@/lib/api/with-route";
import { getContainer } from "@/server/container";
import { startChaosSchema } from "@/server/services/chaos-service";

export const dynamic = "force-dynamic";

export const GET = withQuery(z.object({}), () => ok(getContainer().chaosService.list()));

export const POST = withRoute(startChaosSchema, (input) => ok(getContainer().chaosService.start(input), undefined, { status: 201 }));
