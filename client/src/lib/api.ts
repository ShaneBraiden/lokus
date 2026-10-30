/** Thin JSON client for the Lokus API. Errors carry the API's stable `code` so screens can react precisely. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(path: string, options: { method?: Method; body?: unknown; signal?: AbortSignal; keepalive?: boolean } = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      keepalive: options.keepalive,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', 'We could not reach Lokus. Check your connection and try again.');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? 'Something went wrong. Please try again.', e?.details);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal }),
  post: <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => api<T>(path, { method: 'DELETE' }),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

/** Field-level messages from a `validation_failed` error, keyed by field path. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.code !== 'validation_failed' || !Array.isArray(err.details)) return {};
  return Object.fromEntries((err.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
}
