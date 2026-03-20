/**
 * Machine-readable error codes used in the API error envelope.
 * These codes are stable identifiers — do not change existing values.
 */
export const ERROR_CODES = {
  INTERNAL_ERROR: "INTERNAL_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE: "UNPROCESSABLE",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  BAD_GATEWAY: "BAD_GATEWAY",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Maps HTTP status codes to canonical error codes. */
export function statusToCode(status: number): ErrorCode {
  switch (status) {
    case 400: return ERROR_CODES.BAD_REQUEST;
    case 401: return ERROR_CODES.UNAUTHORIZED;
    case 403: return ERROR_CODES.FORBIDDEN;
    case 404: return ERROR_CODES.NOT_FOUND;
    case 409: return ERROR_CODES.CONFLICT;
    case 422: return ERROR_CODES.UNPROCESSABLE;
    case 501: return ERROR_CODES.NOT_IMPLEMENTED;
    case 502: return ERROR_CODES.BAD_GATEWAY;
    case 503: return ERROR_CODES.SERVICE_UNAVAILABLE;
    default:   return ERROR_CODES.INTERNAL_ERROR;
  }
}

export class HttpError extends Error {
  status: number;
  details?: unknown;
  /** Machine-readable error code. Defaults to canonical code derived from status. */
  code?: ErrorCode;

  constructor(status: number, message: string, details?: unknown, code?: ErrorCode) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }

  getCode(): ErrorCode {
    return this.code ?? statusToCode(this.status);
  }
}

export function badRequest(message: string, details?: unknown) {
  return new HttpError(400, message, details);
}

export function unauthorized(message = "Unauthorized") {
  return new HttpError(401, message);
}

export function forbidden(message = "Forbidden") {
  return new HttpError(403, message);
}

export function notFound(message = "Not found") {
  return new HttpError(404, message);
}

export function conflict(message: string, details?: unknown) {
  return new HttpError(409, message, details);
}

export function unprocessable(message: string, details?: unknown) {
  return new HttpError(422, message, details);
}
