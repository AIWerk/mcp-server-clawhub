// ClawHub.ai HTTP client
// Base URL: https://clawhub.ai, API prefix: /api/v1
// Auth: optional HTTP Bearer. Server operates in anonymous mode if CLAWHUB_TOKEN is unset.

export type ClawHubErrorKind =
  | 'http' // server returned a non-2xx status
  | 'timeout' // AbortError from AbortSignal.timeout
  | 'network' // DNS / connection reset / TLS / offline
  | 'parse'; // server returned a 2xx with non-JSON body on a JSON endpoint

export class ClawHubApiError extends Error {
  constructor(
    public readonly kind: ClawHubErrorKind,
    public readonly status: number,
    public readonly statusText: string,
    message: string
  ) {
    super(message);
    this.name = 'ClawHubApiError';
  }
}

const REQUEST_TIMEOUT_MS = 30_000;
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
const RATE_LIMIT_STATUS = 429;

export function getToken(): string | undefined {
  const t = process.env.CLAWHUB_TOKEN;
  return t && t.trim() ? t.trim() : undefined;
}

export function hasAuth(): boolean {
  return getToken() !== undefined;
}

function getBaseUrl(): string {
  return (process.env.CLAWHUB_BASE_URL ?? 'https://clawhub.ai/api/v1').replace(/\/$/, '');
}

function buildHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': '@aiwerk/mcp-server-clawhub',
  };
  if (contentType) headers['Content-Type'] = contentType;
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function requireAuth(context: string): void {
  if (!hasAuth()) {
    throw new ClawHubApiError(
      'http',
      401,
      'Unauthorized',
      `${context} requires authentication. Set CLAWHUB_TOKEN to enable this tool.`
    );
  }
}

async function handleJson<T>(response: Response, context: string): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    let detail = '';
    try {
      const body = JSON.parse(text) as { error?: { message?: string }; message?: string };
      detail = body?.error?.message ?? body?.message ?? '';
    } catch {
      // Body is not JSON — surface a trimmed plain-text excerpt so upstream 4xx/5xx
      // detail (e.g. "invalid hash format") reaches operators instead of being silently dropped.
      const trimmed = text.trim();
      if (trimmed) detail = trimmed.slice(0, 200);
    }

    let msg = `${context}: ${response.status} ${response.statusText}`;
    if (detail) msg += ` - ${detail}`;

    if (response.status === 401) msg = `ClawHub API error: 401 Unauthorized - check CLAWHUB_TOKEN`;
    else if (response.status === 404) msg = `ClawHub API error: 404 Not Found - ${context.toLowerCase()}`;
    else if (response.status === RATE_LIMIT_STATUS) msg = `ClawHub API error: 429 Too Many Requests - rate limit exceeded`;
    else if (TRANSIENT_STATUSES.has(response.status)) msg = `ClawHub API error: ${response.status} ${response.statusText} - upstream transient failure`;

    throw new ClawHubApiError('http', response.status, response.statusText, msg);
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ClawHubApiError('parse', response.status, response.statusText, `${context}: response was not valid JSON`);
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function retryDelayMs(response: Response | null, attempt: number): number {
  if (response) {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.min(parsed * 1000, 60_000);
      }
    }
  }
  // Fixed, bounded backoff — no exponential runaway.
  return attempt === 1 ? 1_000 : 3_000;
}

async function rawFetch(url: string, init: RequestInit, context: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    if (isAbortError(err)) {
      throw new ClawHubApiError('timeout', 0, 'Timeout', `${context}: request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new ClawHubApiError('network', 0, 'NetworkError', `${context}: network failure - ${msg}`);
  }
}

// Single controlled retry for 429 + 5xx transient failures. Timeouts and network
// errors are not retried (they often indicate real problems — surfacing them is
// more useful than masking with a blind retry).
async function fetchWithRetry(url: string, init: RequestInit, context: string): Promise<Response> {
  const first = await rawFetch(url, init, context);
  if (first.status !== RATE_LIMIT_STATUS && !TRANSIENT_STATUSES.has(first.status)) {
    return first;
  }
  const delay = retryDelayMs(first, 1);
  await new Promise((r) => setTimeout(r, delay));
  return rawFetch(url, init, context);
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  let url = `${getBaseUrl()}${path}`;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

export async function clawGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  opts: { authRequired?: boolean } = {}
): Promise<T> {
  if (opts.authRequired) requireAuth(`GET ${path}`);
  const context = `GET ${path}`;
  const response = await fetchWithRetry(buildUrl(path, params), {
    method: 'GET',
    headers: buildHeaders(),
  }, context);
  return handleJson<T>(response, context);
}

export async function clawGetRaw(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<{ status: number; contentType: string; text: string }> {
  const context = `GET ${path}`;
  const response = await fetchWithRetry(buildUrl(path, params), {
    method: 'GET',
    headers: buildHeaders(),
  }, context);
  const text = await response.text();
  if (!response.ok) {
    throw new ClawHubApiError(
      'http',
      response.status,
      response.statusText,
      `${context}: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`
    );
  }
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    text,
  };
}

export async function clawGetBinary(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<{ status: number; contentType: string; bytes: Uint8Array }> {
  const context = `GET ${path}`;
  const response = await fetchWithRetry(buildUrl(path, params), {
    method: 'GET',
    headers: buildHeaders(),
  }, context);
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new ClawHubApiError(
      'http',
      response.status,
      response.statusText,
      `${context}: ${response.status} ${response.statusText}${errText ? ` - ${errText.slice(0, 200)}` : ''}`
    );
  }
  const buf = new Uint8Array(await response.arrayBuffer());
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    bytes: buf,
  };
}

export async function clawPost<T>(path: string, body: unknown, opts: { authRequired?: boolean } = { authRequired: true }): Promise<T> {
  if (opts.authRequired) requireAuth(`POST ${path}`);
  const context = `POST ${path}`;
  const response = await fetchWithRetry(buildUrl(path), {
    method: 'POST',
    headers: buildHeaders('application/json'),
    body: JSON.stringify(body),
  }, context);
  return handleJson<T>(response, context);
}

export async function clawDelete<T>(path: string, opts: { authRequired?: boolean } = { authRequired: true }): Promise<T> {
  if (opts.authRequired) requireAuth(`DELETE ${path}`);
  const context = `DELETE ${path}`;
  const response = await fetchWithRetry(buildUrl(path), {
    method: 'DELETE',
    headers: buildHeaders(),
  }, context);
  return handleJson<T>(response, context);
}
