import type { Request } from 'express';
import type { z } from 'zod';
import { badRequest } from './errors';

function parse<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw badRequest('validation_failed', `Some ${what} fields are missing or invalid.`, r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return r.data;
}

export const parseBody = <T>(schema: z.ZodType<T>, req: Request): T => parse(schema, req.body ?? {}, 'request');
export const parseQuery = <T>(schema: z.ZodType<T>, req: Request): T => parse(schema, req.query, 'query');
export const parseParams = <T>(schema: z.ZodType<T>, req: Request): T => parse(schema, req.params, 'path');

export function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
