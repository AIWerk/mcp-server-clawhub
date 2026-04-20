# Changelog

All notable changes to `@aiwerk/mcp-server-clawhub` are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## 0.1.2 — 2026-04-21

Docs-only release.

### Docs
- README: Split install into Hosted (aiwerkmcp.com) and Self-hosted (npx) options. The hosted option lands on `bridge.aiwerk.ch/u/<user-id>/mcp` with zero local setup — token (if any) AES-256-GCM encrypted via Vault.
- README: Added "About AIWerk MCP" footer cross-linking cal, imap, wise.

### Package metadata
- Added `homepage` and `bugs` URL fields — surfaces on npmjs.com and external catalogs.

## 0.1.1 — 2026-04-20

- CLI entry fix: resolve symlinks before the `isCliEntry` check so `npx @aiwerk/mcp-server-clawhub` invocations actually run `main()`. The previous naive `import.meta.url === pathToFileURL(process.argv[1]).href` check failed under npm's bin-shim indirection, causing the server to silently exit on first run via npx.

## 0.1.0 — initial release

- 14 tools in anonymous / authenticated modes, backed by the ClawHub.ai skill catalog.
