// Authenticated tool handlers (CLAWHUB_TOKEN required)

import { clawGet, clawPost, clawDelete } from '../api.js';
import type { WhoamiResponse, PublishResponse, DeleteResponse, PublishInput } from '../types.js';

export async function whoami(): Promise<WhoamiResponse> {
  return clawGet<WhoamiResponse>('/whoami', undefined, { authRequired: true });
}

export async function publish(args: PublishInput): Promise<PublishResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  if (!args.displayName?.trim()) throw new Error('displayName is required');
  if (!args.version?.trim()) throw new Error('version is required');
  if (!Array.isArray(args.files) || args.files.length === 0) {
    throw new Error('files is required (at least one file)');
  }
  return clawPost<PublishResponse>('/skills', args, { authRequired: true });
}

export async function deleteSkill(args: { slug: string; confirm: boolean }): Promise<DeleteResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  if (args.confirm !== true) {
    throw new Error('confirm=true is required to delete a skill (soft delete is reversible via clawhub_undelete)');
  }
  return clawDelete<DeleteResponse>(`/skills/${encodeURIComponent(args.slug)}`, { authRequired: true });
}

export async function undeleteSkill(args: { slug: string }): Promise<DeleteResponse> {
  if (!args.slug?.trim()) throw new Error('slug is required');
  return clawPost<DeleteResponse>(`/skills/${encodeURIComponent(args.slug)}/undelete`, {}, { authRequired: true });
}
