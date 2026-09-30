/**
 * Typed error hierarchy. Route wrappers map these to the API envelope
 * (docs/04 §1) — services never construct HTTP responses directly.
 */

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super("NOT_FOUND", `${resource} "${id}" could not be found.`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(reason: string) {
    super("INVALID_TRANSITION", reason, 409);
  }
}

export class PolicyBlockedError extends AppError {
  constructor(message: string) {
    super("POLICY_BLOCKED", message, 403);
  }
}
