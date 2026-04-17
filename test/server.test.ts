import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from '../src/server.js';

const SAVED_TOKEN = process.env.CLAWHUB_TOKEN;

beforeEach(() => {
  delete process.env.CLAWHUB_TOKEN;
});

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.CLAWHUB_TOKEN;
  else process.env.CLAWHUB_TOKEN = SAVED_TOKEN;
});

// The @modelcontextprotocol/sdk does not expose an inspection API for the
// internal tool registry — the public surface is "connect a transport and
// exchange tools/list". To keep these tests transport-free (and fast), we
// reach into the internals once. If this shape changes, we fail fast.
interface RegistryServer {
  server: {
    _registeredTools?: Record<string, unknown>;
  };
  authenticated: boolean;
}

function listRegisteredTools(bundle: unknown): string[] {
  const b = bundle as RegistryServer;
  const reg = b.server._registeredTools;
  if (!reg) {
    throw new Error(
      'Internal MCP SDK shape changed: expected server._registeredTools to exist — update this probe.'
    );
  }
  return Object.keys(reg);
}

describe('mode-based tool registration', () => {
  test('anonymous mode: 10 read-only tools, no auth tools', () => {
    const bundle = createServer();
    const names = listRegisteredTools(bundle);

    expect(bundle.authenticated).toBe(false);
    expect(names.length).toBe(10);

    const expected = [
      'clawhub_search',
      'clawhub_list_skills',
      'clawhub_get_skill',
      'clawhub_list_versions',
      'clawhub_get_version',
      'clawhub_get_scan',
      'clawhub_get_moderation',
      'clawhub_get_file',
      'clawhub_resolve',
      'clawhub_download',
    ];
    for (const t of expected) expect(names).toContain(t);

    const forbidden = ['clawhub_whoami', 'clawhub_publish', 'clawhub_delete', 'clawhub_undelete'];
    for (const t of forbidden) expect(names).not.toContain(t);
  });

  test('authenticated mode: all 14 tools registered', () => {
    process.env.CLAWHUB_TOKEN = 'test-token';
    const bundle = createServer();
    const names = listRegisteredTools(bundle);

    expect(bundle.authenticated).toBe(true);
    expect(names.length).toBe(14);

    for (const t of [
      'clawhub_whoami',
      'clawhub_publish',
      'clawhub_delete',
      'clawhub_undelete',
    ]) {
      expect(names).toContain(t);
    }
  });

  test('whitespace-only token is treated as anonymous', () => {
    process.env.CLAWHUB_TOKEN = '   ';
    const bundle = createServer();
    expect(bundle.authenticated).toBe(false);
    expect(listRegisteredTools(bundle).length).toBe(10);
  });
});
