import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** An error with an HTTP status and a stable machine-readable code (the web app switches on `code`). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new HttpError(400, code, message, details);
export const unauthorized = (message = 'Sign in to continue.') => new HttpError(401, 'unauthenticated', message);
export const forbidden = (code = 'forbidden', message = 'You do not have access to this resource.') => new HttpError(403, code, message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);
export const conflict = (code: string, message: string, details?: unknown) => new HttpError(409, code, message, details);
export const gone = (code: string, message: string) => new HttpError(410, code, message);

export const apiNotFound: RequestHandler = (req, _res, next) => next(notFound(`No API route for ${req.method} ${req.path}.`));

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'validation_failed', message: 'Some fields are missing or invalid.', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'The request body is not valid JSON.' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'The request body is too large.' } });
    return;
  }
  req.log?.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } });
};
