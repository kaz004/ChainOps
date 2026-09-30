/**
 * API response envelope (docs/04 §1). All route handlers return these shapes.
 */

import { NextResponse } from "next/server";
import { AppError } from "@/server/core/errors";

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  generatedAt?: string;
}

export type ApiOk<T> = { data: T; meta?: ApiMeta };
export type ApiErr = { error: { code: string; message: string; requestId: string } };

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json(meta ? { data, meta } : { data }, init);
}

export function fail(
  code: string,
  message: string,
  httpStatus: number,
  requestId?: string,
): NextResponse<ApiErr> {
  return NextResponse.json(
    { error: { code, message, requestId: requestId ?? `req_${crypto.randomUUID().slice(0, 12)}` } },
    { status: httpStatus },
  );
}

/** Map any thrown error to the envelope without leaking internals. */
export function errorResponse(err: unknown): NextResponse<ApiErr> {
  if (err instanceof AppError) {
    return fail(err.code, err.message, err.httpStatus);
  }
  // Unexpected: log server-side only; generic message to client.
  console.error("[api] unhandled error:", err);
  return fail("INTERNAL", "An unexpected error occurred. Please retry.", 500);
}
