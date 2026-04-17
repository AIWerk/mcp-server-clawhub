import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClawHubApiError, hasAuth, clawGet, clawGetRaw, clawGetBinary, clawPost, clawDelete } from '../src/api.js';

const SAVED_TOKEN = process.env.CLAWHUB_TOKEN;
const SAVED_BASE = process.env.CLAWHUB_BASE_URL;

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function errorResponse(status: number, body: unknown = { error: 'x' }, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : status === 429 ? 'Too Many Requests' : 'Error',
    headers: { 'content-type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  process.env.CLAWHUB_BASE_URL = 'https://clawhub.test/api/v1';
  delete process.env.CLAWHUB_TOKEN;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (SAVED_TOKEN === undefined) delete process.env.CLAWHUB_TOKEN;
  else process.env.CLAWHUB_TOKEN = SAVED_TOKEN;
  if (SAVED_BASE === undefined) delete process.env.CLAWHUB_BASE_URL;
  else process.env.CLAWHUB_BASE_URL = SAVED_BASE;
});

describe('auth mode', () => {
  test('hasAuth() is false when CLAWHUB_TOKEN is unset', () => {
    delete process.env.CLAWHUB_TOKEN;
    expect(hasAuth()).toBe(false);
  });

  test('hasAuth() is false for whitespace-only token', () => {
    process.env.CLAWHUB_TOKEN = '   ';
    expect(hasAuth()).toBe(false);
  });

  test('hasAuth() is true for a set token', () => {
    process.env.CLAWHUB_TOKEN = 'secret';
    expect(hasAuth()).toBe(true);
  });

  test('clawPost with authRequired throws 401 ClawHubApiError when anonymous', async () => {
    mockFetch(async () => jsonResponse({}));
    await expect(clawPost('/skills', {})).rejects.toMatchObject({
      name: 'ClawHubApiError',
      kind: 'http',
      status: 401,
    });
  });

  test('clawGet without authRequired sends no Authorization header when anonymous', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch(async (_url, init) => {
      capturedInit = init;
      return jsonResponse({ ok: true });
    });
    await clawGet('/skills');
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  test('clawGet attaches Bearer header when token is set', async () => {
    process.env.CLAWHUB_TOKEN = 'my-token';
    let capturedInit: RequestInit | undefined;
    mockFetch(async (_url, init) => {
      capturedInit = init;
      return jsonResponse({ ok: true });
    });
    await clawGet('/whoami', undefined, { authRequired: true });
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-token');
  });
});

describe('error mapping', () => {
  test('401 → kind=http, status=401, message mentions CLAWHUB_TOKEN', async () => {
    mockFetch(async () => errorResponse(401, { error: 'unauthorized' }));
    const err = await clawGet('/whoami').catch((e) => e);
    expect(err).toBeInstanceOf(ClawHubApiError);
    expect(err.kind).toBe('http');
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/CLAWHUB_TOKEN/);
  });

  test('404 → kind=http, status=404, message mentions Not Found', async () => {
    mockFetch(async () => errorResponse(404));
    const err = await clawGet('/skills/missing').catch((e) => e);
    expect(err.status).toBe(404);
    expect(err.message).toMatch(/404 Not Found/);
  });

  test('429 triggers ONE retry then throws if second call still 429', async () => {
    const calls: string[] = [];
    mockFetch(async () => {
      calls.push('call');
      return errorResponse(429, { error: 'rate' }, { 'Retry-After': '0' });
    });
    const err = await clawGet('/search', { q: 'x' }).catch((e) => e);
    expect(calls.length).toBe(2);
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/rate limit/);
  });

  test('500 → retried once, then surfaced as http error', async () => {
    const calls: string[] = [];
    mockFetch(async () => {
      calls.push('call');
      return errorResponse(500, { error: 'boom' });
    });
    const err = await clawGet('/search', { q: 'x' }).catch((e) => e);
    expect(calls.length).toBe(2);
    expect(err.status).toBe(500);
    expect(err.message).toMatch(/transient/);
  });

  test('network failure → kind=network, not retried', async () => {
    const calls: string[] = [];
    mockFetch(async () => {
      calls.push('call');
      throw new TypeError('fetch failed');
    });
    const err = await clawGet('/search', { q: 'x' }).catch((e) => e);
    expect(calls.length).toBe(1); // not retried
    expect(err.kind).toBe('network');
  });

  test('timeout (AbortError) → kind=timeout, not retried', async () => {
    const calls: string[] = [];
    mockFetch(async () => {
      calls.push('call');
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    const err = await clawGet('/search', { q: 'x' }).catch((e) => e);
    expect(calls.length).toBe(1);
    expect(err.kind).toBe('timeout');
  });

  test('2xx with non-JSON body → kind=parse', async () => {
    mockFetch(async () =>
      new Response('not json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const err = await clawGet('/search', { q: 'x' }).catch((e) => e);
    expect(err.kind).toBe('parse');
  });
});

describe('response passthrough (wire shape)', () => {
  test('list endpoint returns items[] shape as-is', async () => {
    mockFetch(async () => jsonResponse({ items: [{ slug: 'a' }], nextCursor: null }));
    const result = await clawGet<{ items: unknown[]; nextCursor: string | null }>('/skills');
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  test('moderation endpoint returns wrapped shape as-is', async () => {
    mockFetch(async () => jsonResponse({ moderation: { verdict: 'clean' } }));
    const result = await clawGet<{ moderation: { verdict: string } }>('/skills/x/moderation');
    expect(result.moderation.verdict).toBe('clean');
  });

  test('whoami returns wrapped user object', async () => {
    mockFetch(async () => jsonResponse({ user: { handle: 'attila' } }));
    const result = await clawGet<{ user: { handle: string } }>('/whoami');
    expect(result.user.handle).toBe('attila');
  });
});

describe('raw + binary helpers', () => {
  test('clawGetRaw returns text and content-type', async () => {
    mockFetch(async () =>
      new Response('# hello', {
        status: 200,
        headers: { 'content-type': 'text/markdown' },
      })
    );
    const { text, contentType } = await clawGetRaw('/skills/x/file', { path: 'README.md' });
    expect(text).toBe('# hello');
    expect(contentType).toBe('text/markdown');
  });

  test('clawGetBinary returns Uint8Array of the body', async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    mockFetch(async () =>
      new Response(payload, {
        status: 200,
        headers: { 'content-type': 'application/zip' },
      })
    );
    const { bytes, contentType } = await clawGetBinary('/download', { slug: 'x' });
    expect(bytes.length).toBe(4);
    expect(contentType).toBe('application/zip');
  });
});

describe('authenticated write surface', () => {
  beforeEach(() => {
    process.env.CLAWHUB_TOKEN = 'wr-token';
  });

  test('clawPost sends Bearer + JSON body', async () => {
    let captured: RequestInit | undefined;
    mockFetch(async (_url, init) => {
      captured = init;
      return jsonResponse({ ok: true });
    });
    await clawPost('/skills', { slug: 's' });
    expect((captured?.headers as Record<string, string>)['Authorization']).toBe('Bearer wr-token');
    expect(captured?.body).toBe(JSON.stringify({ slug: 's' }));
    expect((captured?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  test('clawDelete sends Bearer on DELETE', async () => {
    let captured: RequestInit | undefined;
    mockFetch(async (_url, init) => {
      captured = init;
      return jsonResponse({ ok: true });
    });
    await clawDelete('/skills/x');
    expect(captured?.method).toBe('DELETE');
    expect((captured?.headers as Record<string, string>)['Authorization']).toBe('Bearer wr-token');
  });
});
