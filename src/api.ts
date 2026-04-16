// ClawHub.ai HTTP client
// Base URL: https://clawhub.ai, API prefix: /api/v1
// Auth: optional HTTP Bearer. Server operates in anonymous mode if CLAWHUB_TOKEN is unset.

export class ClawHubApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    message: string
  ) {
    super(message);
    this.name = 'ClawHubApiError';
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

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
      // body not JSON
    }

    let msg = `${context}: ${response.status} ${response.statusText}`;
    if (detail) msg += ` - ${detail}`;

    if (response.status === 401) msg = `ClawHub API error: 401 Unauthorized - check CLAWHUB_TOKEN`;
    else if (response.status === 404) msg = `ClawHub API error: 404 Not Found - ${context.toLowerCase()}`;
    else if (response.status === 429) msg = `ClawHub API error: 429 Too Many Requests - rate limit exceeded`;

    throw new ClawHubApiError(response.status, response.statusText, msg);
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${context}: failed to parse response as JSON`);
  }
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const delayMs = retryAfter ? Math.min(Number(retryAfter) * 1000, 60_000) : 2000;
    await new Promise((r) => setTimeout(r, delayMs));
    return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }
  return response;
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
  const response = await fetchWithRetry(buildUrl(path, params), {
    method: 'GET',
    headers: buildHeaders(),
  });
  return handleJson<T>(response, `GET ${path}`);
}

export async function clawGetRaw(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<{ status: number; contentType: string; text: string }> {
  const response = await fetchWithRetry(buildUrl(path, params), {
    method: 'GET',
    headers: buildHeaders(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ClawHubApiError(
      response.status,
      response.statusText,
      `GET ${path}: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`
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
  const response = await fetchWithRetry(buildUrl(path, params), {
    method: 'GET',
    headers: buildHeaders(),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new ClawHubApiError(
      response.status,
      response.statusText,
      `GET ${path}: ${response.status} ${response.statusText}${errText ? ` - ${errText.slice(0, 200)}` : ''}`
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
  const response = await fetchWithRetry(buildUrl(path), {
    method: 'POST',
    headers: buildHeaders('application/json'),
    body: JSON.stringify(body),
  });
  return handleJson<T>(response, `POST ${path}`);
}

export async function clawDelete<T>(path: string, opts: { authRequired?: boolean } = { authRequired: true }): Promise<T> {
  if (opts.authRequired) requireAuth(`DELETE ${path}`);
  const response = await fetchWithRetry(buildUrl(path), {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  return handleJson<T>(response, `DELETE ${path}`);
}
