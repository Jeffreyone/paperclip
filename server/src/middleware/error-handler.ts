import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ERROR_CODES, HttpError, statusToCode } from "../errors.js";

export interface ErrorContext {
  error: { message: string; stack?: string; name?: string; details?: unknown; raw?: unknown };
  method: string;
  url: string;
  reqBody?: unknown;
  reqParams?: unknown;
  reqQuery?: unknown;
}

function attachErrorContext(
  req: Request,
  res: Response,
  payload: ErrorContext["error"],
  rawError?: Error,
) {
  (res as any).__errorContext = {
    error: payload,
    method: req.method,
    url: req.originalUrl,
    reqBody: req.body,
    reqParams: req.params,
    reqQuery: req.query,
  } satisfies ErrorContext;
  if (rawError) {
    (res as any).err = rawError;
  }
}

function sendErrorEnvelope(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  res.status(status).json({ code, message, ...(details !== undefined ? { details } : {}) });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      attachErrorContext(
        req,
        res,
        { message: err.message, stack: err.stack, name: err.name, details: err.details },
        err,
      );
    }
    sendErrorEnvelope(res, err.status, err.getCode(), err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendErrorEnvelope(res, 400, ERROR_CODES.VALIDATION_ERROR, "Validation error", err.errors);
    return;
  }

  const rootError = err instanceof Error ? err : new Error(String(err));
  attachErrorContext(
    req,
    res,
    err instanceof Error
      ? { message: err.message, stack: err.stack, name: err.name }
      : { message: String(err), raw: err, stack: rootError.stack, name: rootError.name },
    rootError,
  );

  sendErrorEnvelope(res, 500, ERROR_CODES.INTERNAL_ERROR, "Internal server error");
}
