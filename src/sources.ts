/**
 * The approved content: BullMQ's public documentation (MIT licence), read from its GitHub repository at ingest time.
 * The text is fetched by `npm run ingest` and never committed. Swap these three constants to point the assistant at
 * another product's docs.
 */
export const REPO = "taskforcesh/bullmq";
export const BRANCH = "master";
export const DOCS_DIR = "docs/gitbook/";

/** Which pages count as approved: the guide and the patterns. Changelogs, other languages, the legacy Bull docs and
 *  deprecated pages (QueueScheduler, not needed since BullMQ 2.0) are left out, so old advice is never quoted. */
export const INCLUDE = /^(guide|patterns)\//;
export const EXCLUDE = /changelog|queuescheduler/i;

/** The public address a reader would open: docs.bullmq.io/<path>, where a folder's README is the folder itself. */
export function publicUrl(path: string): string {
  const page = path.replace(/\.md$/, "").replace(/(^|\/)README$/, "");
  return `https://docs.bullmq.io/${page}`.replace(/\/$/, "");
}
