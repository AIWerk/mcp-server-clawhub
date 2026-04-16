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

export interface SkillListResponse {
  skills: SkillListItem[];
  nextCursor?: string;
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
  versions: SkillVersion[];
  nextCursor?: string;
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

export interface ModerationResponse {
  verdict?: string;
  reasonCodes?: string[];
  summary?: string;
  evidence?: unknown[];
  [key: string]: unknown;
}

export interface WhoamiResponse {
  user: {
    handle?: string;
    displayName?: string;
    image?: string;
    [key: string]: unknown;
  };
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
