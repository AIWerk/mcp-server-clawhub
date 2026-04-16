#!/usr/bin/env node
// ClawHub.ai MCP server — skill catalog discovery and (optional) publishing
// Operates in two modes:
//   - anonymous: CLAWHUB_TOKEN unset. Only read-only tools are registered.
//   - authenticated: CLAWHUB_TOKEN set. All tools are registered.

import * as z from 'zod/v4';
import { readFileSync } from 'fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';

import { hasAuth } from './api.js';
import {
  search,
  listSkills,
  getSkill,
  listVersions,
  getVersion,
  getScan,
  getModeration,
  getFile,
  resolve,
  download,
} from './tools/search.js';
import { whoami, publish, deleteSkill, undeleteSkill } from './tools/auth.js';

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')) as { version: string };
    return pkg.version;
  }
}

const VERSION = readPackageVersion();

function toolSuccess(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

export function createServer() {
  const server = new McpServer({
    name: '@aiwerk/mcp-server-clawhub',
    version: VERSION,
  });

  const authenticated = hasAuth();

  // ---- Public / read-only tools (always registered) ----

  server.registerTool(
    'clawhub_search',
    {
      description:
        'Search skills in the ClawHub.ai catalog. Required: q (search query). Optional: limit, highlightedOnly, nonSuspiciousOnly.',
      inputSchema: {
        q: z.string().min(1),
        limit: z.number().int().min(1).max(100).optional(),
        highlightedOnly: z.boolean().optional(),
        nonSuspiciousOnly: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await search(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_list_skills',
    {
      description:
        'List skills in the catalog with cursor pagination. Optional: limit, cursor (from previous response.nextCursor), nonSuspiciousOnly.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
        nonSuspiciousOnly: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await listSkills(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_get_skill',
    {
      description: 'Get full details of a skill by slug (includes latestVersion, owner, moderation). Required: slug.',
      inputSchema: {
        slug: z.string().min(1),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await getSkill(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_list_versions',
    {
      description: 'List all versions of a skill. Required: slug. Optional: limit, cursor.',
      inputSchema: {
        slug: z.string().min(1),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await listVersions(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_get_version',
    {
      description: 'Get a specific version of a skill, including files and security snapshot. Required: slug, version.',
      inputSchema: {
        slug: z.string().min(1),
        version: z.string().min(1),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await getVersion(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_get_scan',
    {
      description:
        'Get the security scan result for a skill version. Required: slug. Optional: version or tag (defaults to latest).',
      inputSchema: {
        slug: z.string().min(1),
        version: z.string().optional(),
        tag: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await getScan(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_get_moderation',
    {
      description: 'Get moderation details (verdict, reasonCodes, evidence) for a skill. Required: slug.',
      inputSchema: {
        slug: z.string().min(1),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await getModeration(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_get_file',
    {
      description:
        'Fetch a single raw file from a skill package. Required: slug, path. Optional: version or tag (defaults to latest). Returns the file as text.',
      inputSchema: {
        slug: z.string().min(1),
        path: z.string().min(1),
        version: z.string().optional(),
        tag: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await getFile(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_resolve',
    {
      description:
        'Resolve a version of a skill by content hash. Returns the matching version (if any) and the latest version for comparison. Required: slug, hash.',
      inputSchema: {
        slug: z.string().min(1),
        hash: z.string().min(1),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await resolve(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'clawhub_download',
    {
      description:
        'Download a skill as a zip archive. Required: slug. Optional: version or tag (defaults to latest). Response includes base64-encoded zip bytes and size.',
      inputSchema: {
        slug: z.string().min(1),
        version: z.string().optional(),
        tag: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return toolSuccess(await download(args));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  // ---- Authenticated tools (only registered when CLAWHUB_TOKEN is set) ----

  if (authenticated) {
    server.registerTool(
      'clawhub_whoami',
      {
        description: 'Return the authenticated user (handle, displayName, image). Requires CLAWHUB_TOKEN.',
        inputSchema: {},
      },
      async () => {
        try {
          return toolSuccess(await whoami());
        } catch (error) {
          return toolError(error);
        }
      }
    );

    server.registerTool(
      'clawhub_publish',
      {
        description:
          'Publish a new skill version. Requires CLAWHUB_TOKEN. Required: slug, displayName, version, files (array of { path, content, encoding? }). Optional: changelog, tags, forkOf.',
        inputSchema: {
          slug: z.string().min(1),
          displayName: z.string().min(1),
          version: z.string().min(1),
          changelog: z.string().optional(),
          tags: z.array(z.string()).optional(),
          forkOf: z.string().optional(),
          files: z
            .array(
              z.object({
                path: z.string().min(1),
                content: z.string(),
                encoding: z.enum(['utf8', 'base64']).optional(),
              })
            )
            .min(1),
        },
      },
      async (args) => {
        try {
          return toolSuccess(await publish(args));
        } catch (error) {
          return toolError(error);
        }
      }
    );

    server.registerTool(
      'clawhub_delete',
      {
        description:
          'Soft-delete a skill. Requires CLAWHUB_TOKEN. Required: slug, confirm (must be true). Reversible via clawhub_undelete.',
        inputSchema: {
          slug: z.string().min(1),
          confirm: z.literal(true),
        },
      },
      async (args) => {
        try {
          return toolSuccess(await deleteSkill(args));
        } catch (error) {
          return toolError(error);
        }
      }
    );

    server.registerTool(
      'clawhub_undelete',
      {
        description: 'Restore a soft-deleted skill. Requires CLAWHUB_TOKEN. Required: slug.',
        inputSchema: {
          slug: z.string().min(1),
        },
      },
      async (args) => {
        try {
          return toolSuccess(await undeleteSkill(args));
        } catch (error) {
          return toolError(error);
        }
      }
    );
  }

  return {
    server,
    authenticated,
    close: async () => {
      await server.close();
    },
  };
}

async function main() {
  const { server, authenticated, close } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `@aiwerk/mcp-server-clawhub v${VERSION} ready — ${authenticated ? 'authenticated' : 'anonymous'} mode\n`
  );

  const shutdown = async () => {
    await close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

const isMain = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
