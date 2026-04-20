# @aiwerk/mcp-server-clawhub

MCP server for the [ClawHub.ai](https://clawhub.ai) skill catalog.

Browse, search, inspect, download, and (when authenticated) publish skills from the ClawHub registry through the Model Context Protocol.

## Two modes

The server adapts to whether a token is configured:

| Mode            | Trigger                | Available tools |
|-----------------|------------------------|-----------------|
| **anonymous**   | `CLAWHUB_TOKEN` unset  | 10 read-only tools (search, list, get, scan, moderation, file, resolve, download) |
| **authenticated** | `CLAWHUB_TOKEN` set  | All 14 tools (adds whoami, publish, delete, undelete) |

The authenticated tools are simply not registered in anonymous mode — `tools/list` will not advertise them.

## Install

Two ways to run this server — pick the one that fits.

### Option 1 — Hosted (zero setup)

No local runtime — if you set a token, it's AES-256-GCM encrypted server-side via HashiCorp Vault.

1. Sign up at **[aiwerkmcp.com](https://aiwerkmcp.com)**.
2. Install **ClawHub** from the catalog. Leave `CLAWHUB_TOKEN` empty for anonymous mode (10 read-only tools), or paste a token to unlock all 14.
3. Point your MCP client (Claude.ai, Cursor, Hermes, …) at your hosted endpoint:
   ```
   https://bridge.aiwerk.ch/u/<your-user-id>/mcp
   ```
   with your Bearer token.

### Option 2 — Self-hosted (npx)

Run directly — you manage the token:

```bash
npx -y @aiwerk/mcp-server-clawhub
```

Or in your MCP client config:

```json
{
  "mcpServers": {
    "clawhub": {
      "command": "npx",
      "args": ["-y", "@aiwerk/mcp-server-clawhub"],
      "env": {
        "CLAWHUB_TOKEN": "optional - unlocks publish/delete/whoami"
      }
    }
  }
}
```

## Tools

### Read-only (anonymous + authenticated)

| Tool | Description |
|------|-------------|
| `clawhub_search` | Search skills by query string — **primary discovery path** |
| `clawhub_list_skills` | List skills with cursor pagination (see caveat below) |
| `clawhub_get_skill` | Full details for a skill slug |
| `clawhub_list_versions` | List all versions of a skill |
| `clawhub_get_version` | Get a specific version (files + security snapshot) |
| `clawhub_get_scan` | Security scan result for a version |
| `clawhub_get_moderation` | Moderation verdict and evidence (response wraps under `moderation`) |
| `clawhub_get_file` | Fetch a single raw file from a skill |
| `clawhub_resolve` | Resolve version by content hash |
| `clawhub_download` | Download skill zip (base64 encoded) |

> **Discovery caveat:** the live `/skills` endpoint applies a default server-side filter that may
> return an empty `items[]` for ungated browsing. In practice, **prefer `clawhub_search`** — it's the
> reliable entry point for finding skills by keyword. Use `clawhub_list_skills` with cursor pagination
> only when you have a specific filter in mind (e.g. `nonSuspiciousOnly=true`). The `highlightedOnly`
> flag is available on `clawhub_search` but not on `clawhub_list_skills`.

### Wire shapes worth knowing

Some live API responses differ from the published OpenAPI spec. The types in `src/types.ts` follow
the **real wire shape**:

- `clawhub_list_skills` → `{ items: [...], nextCursor }` (not `skills`)
- `clawhub_list_versions` → `{ items: [...], nextCursor }` (not `versions`)
- `clawhub_get_moderation` → `{ moderation: { verdict, ... } }` (wrapped)
- `clawhub_whoami` → `{ user: { handle, ... } }` (wrapped)
- `clawhub_get_moderation` returns **404** for skills with no moderation events — this means *clean*,
  not *missing*. For the always-present verdict, read `.moderation` from `clawhub_get_skill`.

### Authenticated only (CLAWHUB_TOKEN required)

| Tool | Description |
|------|-------------|
| `clawhub_whoami` | Current user (handle, displayName, image) |
| `clawhub_publish` | Publish a new skill version |
| `clawhub_delete` | Soft-delete a skill (reversible) |
| `clawhub_undelete` | Restore a soft-deleted skill |

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `CLAWHUB_TOKEN` | no | Bearer token issued by clawhub.ai. Unlocks auth-only tools and raises rate limits (120/min → 600/min for reads). |
| `CLAWHUB_BASE_URL` | no | Override the API base URL. Defaults to `https://clawhub.ai/api/v1`. |

## Rate limits

- **Anonymous:** 120 reads/min per IP, 30 writes/min per IP
- **Authenticated:** 600 reads/min per key, 120 writes/min per key

## Development

```bash
npm install
npm run build
npm test
```

## About AIWerk MCP

Part of the **[AIWerk MCP platform](https://aiwerkmcp.com)** — curated, signed MCP recipes served either as npm packages for self-hosting or through our multi-tenant hosted bridge (`bridge.aiwerk.ch`).

Other AIWerk MCP servers:

- [@aiwerk/mcp-server-cal](https://github.com/AIWerk/mcp-server-cal) — Cal.com scheduling
- [@aiwerk/mcp-server-imap](https://github.com/AIWerk/mcp-server-imap) — IMAP/SMTP email, provider-agnostic
- [@aiwerk/mcp-server-wise](https://github.com/AIWerk/mcp-server-wise) — Wise (TransferWise) Personal API, read-only

Browse the full catalog (20+ recipes including GitHub, Linear, Notion, Stripe, …) at [aiwerkmcp.com](https://aiwerkmcp.com).

## License

MIT © AIWerk
