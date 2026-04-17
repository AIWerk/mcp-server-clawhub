// Minimal type shapes for ClawHub.ai responses.
// The API returns rich payloads; we use `unknown`/`Record` for nested objects and pass them through.

export interface SearchResult {
  score: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SearchResponse {
  results: SearchResult[];
  [key: string]: unknown;
}

export interface SkillListItem {
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// The live ClawHub API returns skill lists under `items` (not `skills` as the OpenAPI spec
// suggests). We keep a passthrough index signature so non-declared fields still travel end-to-end.
export interface SkillListResponse {
  items: SkillListItem[];
  nextCursor?: string | null;
  [key: string]: unknown;
}

export interface SkillResponse {
  skill: Record<string, unknown>;
  latestVersion?: Record<string, unknown>;
  owner?: Record<string, unknown>;
  moderation?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SkillVersion {
  version: string;
  hash?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SkillVersionListResponse {
  items: SkillVersion[];
  nextCursor?: string | null;
  [key: string]: unknown;
}

export interface SkillVersionResponse {
  skill: Record<string, unknown>;
  version: Record<string, unknown>;
  files?: unknown[];
  security?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SkillScanResponse {
  skill: Record<string, unknown>;
  version: Record<string, unknown>;
  moderation?: Record<string, unknown>;
  security?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ResolveResponse {
  match?: { version: string };
  latestVersion?: { version: string };
  [key: string]: unknown;
}

// /skills/{slug}/moderation wraps the verdict payload under a `moderation` key.
// The OpenAPI spec listed fields at the top level but the wire shape uses a wrapper.
export interface ModerationVerdict {
  verdict?: string;
  reasonCodes?: string[];
  summary?: string;
  evidence?: unknown[];
  [key: string]: unknown;
}

export interface ModerationResponse {
  moderation: ModerationVerdict;
  [key: string]: unknown;
}

// /whoami wraps the user payload under a `user` key (verified against live API 2026-04-16).
export interface WhoamiUser {
  handle?: string;
  displayName?: string;
  image?: string;
  [key: string]: unknown;
}

export interface WhoamiResponse {
  user: WhoamiUser;
  [key: string]: unknown;
}

export interface PublishResponse {
  ok: boolean;
  skillId?: string;
  versionId?: string;
  [key: string]: unknown;
}

export interface DeleteResponse {
  ok: boolean;
  [key: string]: unknown;
}

export interface PublishInput {
  slug: string;
  displayName: string;
  version: string;
  changelog?: string;
  tags?: string[];
  forkOf?: string;
  files: Array<{
    path: string;
    content: string;
    encoding?: 'utf8' | 'base64';
  }>;
}
