import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SyncSelector } from '../lib/config.js'
import { loadConfig, saveConfig, selectSync } from '../lib/config.js'
import { FileNotFoundError, SyncNotFoundError } from '../lib/errors.js'
import {
  createGitHubClient,
  hasIssyncMarkers,
  parseIssueUrl,
  unwrapMarkers,
  wrapWithMarkers,
} from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import { resolvePathWithinBase } from '../lib/path.js'
import { reportSyncResults } from '../lib/sync-reporter.js'
import type { IssyncState, IssyncSync } from '../types/index.js'

export interface PushOptions {
  cwd?: string
  token?: string
  file?: string
  issue?: string
}

export class OptimisticLockError extends Error {
  constructor() {
    super('Remote comment has been updated since last sync. Please run "issync pull" first.')
    this.name = 'OptimisticLockError'
  }
}

/**
 * Ensures remote comment has issync markers, auto-repairs if missing
 */
async function ensureRemoteHasMarkers(
  client: ReturnType<typeof createGitHubClient>,
  owner: string,
  repo: string,
  commentId: number,
  currentBody: string,
): Promise<string> {
  if (hasIssyncMarkers(currentBody)) {
    return currentBody
  }

  console.warn('⚠️  Remote markers missing, re-wrapping...')
  const reWrappedContent = wrapWithMarkers(currentBody)
  await client.updateComment(owner, repo, commentId, reWrappedContent)
  console.log('✅ Markers restored')
  return reWrappedContent
}

/**
 * Push a single sync to remote
 */
async function pushSingleSync(sync: IssyncSync, cwd: string, token?: string): Promise<void> {
  const baseDir = cwd ?? process.cwd()

  // Validate and read local file
  const basePath = path.resolve(baseDir)
  const resolvedPath = resolvePathWithinBase(basePath, sync.local_file, sync.local_file)

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    throw new FileNotFoundError(resolvedPath)
  }

  const localContent = await readFile(resolvedPath, 'utf-8')
  // Remove markers from local content if present (prevents double wrapping)
  const cleanLocalContent = unwrapMarkers(localContent)
  const localHash = calculateHash(cleanLocalContent)

  // Parse issue URL
  const issueInfo = parseIssueUrl(sync.issue_url)

  // Initialize GitHub client
  const client = createGitHubClient(token)

  if (sync.comment_id) {
    // Update existing comment with optimistic locking
    // LIMITATION: This implementation has a TOCTOU (Time-of-check to time-of-use) race condition.
    // Between fetching the remote comment and updating it, another process could modify the comment,
    // causing our update to silently overwrite those changes. A proper solution would require:
    // 1. GitHub API support for conditional updates (ETags/If-Match headers), OR
    // 2. Moving to a server-side solution with transactional updates, OR
    // 3. Implementing a more sophisticated conflict resolution UI
    // For the MVP, we accept this limitation with the expectation that:
    // - Most users will have a single active session
    // - The watch mode will detect conflicts on the next poll
    // - Users can manually recover by running `issync pull` if they detect a conflict

    // Fetch current remote comment
    const remoteComment = await client.getComment(issueInfo.owner, issueInfo.repo, sync.comment_id)

    // Auto-repair: Ensure remote comment has markers
    const normalizedBody = await ensureRemoteHasMarkers(
      client,
      issueInfo.owner,
      issueInfo.repo,
      sync.comment_id,
      remoteComment.body,
    )

    // Unwrap markers from remote content before hash calculation
    const remoteContent = unwrapMarkers(normalizedBody)
    const remoteHash = calculateHash(remoteContent)

    // Check if remote has been updated since last sync
    if (sync.last_synced_hash && remoteHash !== sync.last_synced_hash) {
      throw new OptimisticLockError()
    }

    // Update comment with markers
    const wrappedContent = wrapWithMarkers(cleanLocalContent)
    await client.updateComment(issueInfo.owner, issueInfo.repo, sync.comment_id, wrappedContent)
  } else {
    // Create new comment with markers
    const wrappedContent = wrapWithMarkers(cleanLocalContent)
    const comment = await client.createComment(
      issueInfo.owner,
      issueInfo.repo,
      issueInfo.issue_number,
      wrappedContent,
    )
    sync.comment_id = comment.id
  }

  // Update sync metadata
  sync.last_synced_hash = localHash
  sync.last_synced_at = new Date().toISOString()
}

/**
 * Push all syncs in parallel and report results
 */
async function pushAllSyncs(
  state: IssyncState,
  baseDir: string,
  cwd: string,
  token?: string,
): Promise<void> {
  if (state.syncs.length === 0) {
    throw new SyncNotFoundError()
  }

  // Push all syncs in parallel
  const results = await Promise.allSettled(
    state.syncs.map((sync) => pushSingleSync(sync, baseDir, token)),
  )

  // Collect failures
  const failures = results
    .map((result, index) =>
      result.status === 'rejected' ? { sync: state.syncs[index], reason: result.reason } : null,
    )
    .filter((failure): failure is { sync: IssyncSync; reason: unknown } => failure !== null)

  // Save config (updates successful syncs)
  saveConfig(state, cwd)

  // Report results
  reportSyncResults('push', state.syncs.length, failures)
}

export async function push(options: PushOptions = {}): Promise<void> {
  const { cwd, token, file, issue } = options
  const baseDir = cwd ?? process.cwd()

  // Load config
  const state = loadConfig(cwd)

  // If no selector provided, push all syncs
  if (!file && !issue) {
    await pushAllSyncs(state, baseDir, baseDir, token)
    return
  }

  // Single sync push
  const selector: SyncSelector = {
    file,
    issueUrl: issue,
  }
  const { sync } = selectSync(state, selector, baseDir)

  await pushSingleSync(sync, baseDir, token)
  saveConfig(state, cwd)
}
