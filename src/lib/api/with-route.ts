/**
 * Route-handler wrappers (docs/04 §3) — the single place where request
 * validation, error mapping, requestId and timing live. Route files stay thin.
 */

import type { NextRequest } from "next/server";
import type { ZodTypeAny, z } from "zod";
import { errorResponse, fail } from "./response";

/** JSON body guard — protects against oversized payloads (spec §56). */
const MAX_BODY_BYTES = 16 * 1024;

type Json = Record<string, unknown>;

function newRequestId(): string {
  return `req_${crypto.randomUUID().slice(0, 12)}`;
}

async function readBody(
  req: NextRequest,
  requestId: string,
): Promise<{ ok: true; value: unknown } | { ok: false; res: Response }> {
  if (req.method === "GET" || req.method === "HEAD") return { ok: true, value: {} };
  const text = await req.text();
  if (text.length === 0) return { ok: true, value: {} };
  if (text.length > MAX_BODY_BYTES) {
    return {
      ok: false,
      res: fail("VALIDATION_ERROR", "Request body exceeds the 16 KB limit.", 413, requestId),
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) as Json };
  } catch {
    return { ok: false, res: fail("VALIDATION_ERROR", "Request body is not valid JSON.", 400, requestId) };
  }
}

function parseOrRespond<I>(
  schema: ZodTypeAny,
  raw: unknown,
  requestId: string,
): { ok: true; data: I } | { ok: false; res: Response } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      res: fail(
        "VALIDATION_ERROR",
        issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request.",
        400,
        requestId,
      ),
    };
  }
  return { ok: true, data: parsed.data as I };
}

/** Wrap a JSON-body route handler (POST/PATCH/DELETE, or bodyless GET). */
export function withRoute<S extends ZodTypeAny>(
  schema: S,
  handler: (input: z.output<S>, ctx: { requestId: string }) => Promise<Response> | Response,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    const requestId = newRequestId();
    const started = Date.now();
    try {
      const body = await readBody(req, requestId);
      if (!body.ok) return body.res;
      const parsed = parseOrRespond<z.output<S>>(schema, body.value, requestId);
      if (!parsed.ok) return parsed.res;
      const res = await handler(parsed.data, { requestId });
      res.headers.set("x-request-id", requestId);
      res.headers.set("server-timing", `app;dur=${Date.now() - started}`);
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Wrap a GET route handler that validates its query string. */
export function withQuery<S extends ZodTypeAny>(
  schema: S,
  handler: (input: z.output<S>, ctx: { requestId: string }) => Promise<Response> | Response,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    const requestId = newRequestId();
    const started = Date.now();
    try {
      const url = new URL(req.url);
      const parsed = parseOrRespond<z.output<S>>(schema, Object.fromEntries(url.searchParams), requestId);
      if (!parsed.ok) return parsed.res;
      const res = await handler(parsed.data, { requestId });
      res.headers.set("x-request-id", requestId);
      res.headers.set("server-timing", `app;dur=${Date.now() - started}`);
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Wrap a dynamic route handler (params validated as plain strings). */
export function withParams<P extends Record<string, string> = Record<string, string>>(
  handler: (req: NextRequest, ctx: { params: P; requestId: string }) => Promise<Response> | Response,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response> {
  return async (req: NextRequest, routeCtx: { params: Promise<P> }) => {
    const requestId = newRequestId();
    try {
      const res = await handler(req, { params: await routeCtx.params, requestId });
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Wrap a dynamic route handler with both validated params and a validated body. */
export function withParamsAndBody<
  S extends ZodTypeAny,
  P extends Record<string, string> = Record<string, string>,
>(
  paramsSchema: ZodTypeAny,
  bodySchema: S,
  handler: (
    input: z.output<S>,
    ctx: { params: P; requestId: string },
  ) => Promise<Response> | Response,
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response> {
  return async (req: NextRequest, routeCtx: { params: Promise<P> }) => {
    const requestId = newRequestId();
    const started = Date.now();
    try {
      const rawParams = paramsSchema.safeParse(await routeCtx.params);
      if (!rawParams.success) {
        const issue = rawParams.error.issues[0];
        return fail(
          "VALIDATION_ERROR",
          issue ? `${issue.path.join(".") || "params"}: ${issue.message}` : "Invalid route parameters.",
          400,
          requestId,
        );
      }
      const body = await readBody(req, requestId);
      if (!body.ok) return body.res;
      const parsed = parseOrRespond<z.output<S>>(bodySchema, body.value, requestId);
      if (!parsed.ok) return parsed.res;
      const res = await handler(parsed.data, { params: rawParams.data as P, requestId });
      res.headers.set("x-request-id", requestId);
      res.headers.set("server-timing", `app;dur=${Date.now() - started}`);
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}
