// Public discovery tool handlers (no auth required)

import { clawGet, clawGetRaw, clawGetBinary } from '../api.js';
import type {
  SearchResponse,
  SkillListResponse,
  SkillResponse,
  SkillVersionListResponse,
  SkillVersionResponse,
  SkillScanResponse,
  ResolveResponse,
  ModerationResponse,
} from '../types.js';

export async function search(args: {
  q: string;
  limit?: number;
  highlightedOnly?: boolean;
  nonSuspiciousOnly?: boolean;
}): Promise<SearchResponse> {
  if (!args.q?.trim()) throw new Error('q is required');
  return clawGet<SearchResponse>('/search', {
    q: args.q,
    limit: args.limit,
    highlightedOnly: args.highlightedOnly,
    nonSuspiciousOnly: args.nonSuspiciousOnly,
  });
}

export async function listSkills(args: {
  limit?: number;
  cursor?: string;
  nonSuspiciousOnly?: boolean;
}): Promise<SkillListResponse> {
  return clawGet<SkillListResponse>('/skills', {
    limit: args.limit,
    cursor: args.cursor,
    nonSuspiciousOnly: args.nonSuspiciousOnly,
  });
}

export async function getSkill(args: { slug: string }): Promise<SkillResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  return clawGet<SkillResponse>(`/skills/${encodeURIComponent(args.slug)}`);
}

export async function listVersions(args: {
  slug: string;
  limit?: number;
  cursor?: string;
}): Promise<SkillVersionListResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  return clawGet<SkillVersionListResponse>(`/skills/${encodeURIComponent(args.slug)}/versions`, {
    limit: args.limit,
    cursor: args.cursor,
  });
}

export async function getVersion(args: {
  slug: string;
  version: string;
}): Promise<SkillVersionResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  if (!args.version?.trim()) throw new Error('version is required');
  return clawGet<SkillVersionResponse>(
    `/skills/${encodeURIComponent(args.slug)}/versions/${encodeURIComponent(args.version)}`
  );
}

export async function getScan(args: {
  slug: string;
  version?: string;
  tag?: string;
}): Promise<SkillScanResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  return clawGet<SkillScanResponse>(`/skills/${encodeURIComponent(args.slug)}/scan`, {
    version: args.version,
    tag: args.tag,
  });
}

export async function getModeration(args: { slug: string }): Promise<ModerationResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  return clawGet<ModerationResponse>(`/skills/${encodeURIComponent(args.slug)}/moderation`);
}

export async function getFile(args: {
  slug: string;
  path: string;
  version?: string;
  tag?: string;
}): Promise<{ path: string; version?: string; tag?: string; contentType: string; content: string }> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  if (!args.path?.trim()) throw new Error('path is required');
  const res = await clawGetRaw(`/skills/${encodeURIComponent(args.slug)}/file`, {
    path: args.path,
    version: args.version,
    tag: args.tag,
  });
  return {
    path: args.path,
    version: args.version,
    tag: args.tag,
    contentType: res.contentType,
    content: res.text,
  };
}

export async function resolve(args: { slug: string; hash: string }): Promise<ResolveResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  if (!args.hash?.trim()) throw new Error('hash is required');
  return clawGet<ResolveResponse>('/resolve', { slug: args.slug, hash: args.hash });
}

export async function download(args: {
  slug: string;
  version?: string;
  tag?: string;
}): Promise<{ slug: string; version?: string; tag?: string; contentType: string; bytes: number; zipBase64: string }> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  const res = await clawGetBinary('/download', {
    slug: args.slug,
    version: args.version,
    tag: args.tag,
  });
  return {
    slug: args.slug,
    version: args.version,
    tag: args.tag,
    contentType: res.contentType,
    bytes: res.bytes.length,
    zipBase64: Buffer.from(res.bytes).toString('base64'),
  };
}
