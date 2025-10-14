import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SyncSelector } from '../lib/config.js'
import { loadConfig, saveConfig, selectSync } from '../lib/config.js'
import { FileNotFoundError } from '../lib/errors.js'
import { createGitHubClient, parseIssueUrl } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import { resolvePathWithinBase } from '../lib/path.js'

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

export async function push(options: PushOptions = {}): Promise<void> {
  const { cwd, token, file, issue } = options
  const baseDir = cwd ?? process.cwd()

  // Load config
  const state = loadConfig(cwd)
  const selector: SyncSelector = {
    file,
    issueUrl: issue,
  }
  const { sync } = selectSync(state, selector, baseDir)

  // Validate and read local file
  const basePath = path.resolve(baseDir)
  const resolvedPath = resolvePathWithinBase(basePath, sync.local_file, sync.local_file)

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    throw new FileNotFoundError(resolvedPath)
  }

  const localContent = await readFile(resolvedPath, 'utf-8')
  const localHash = calculateHash(localContent)

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
    const remoteHash = calculateHash(remoteComment.body)

    // Check if remote has been updated since last sync
    if (sync.last_synced_hash && remoteHash !== sync.last_synced_hash) {
      throw new OptimisticLockError()
    }

    // Update comment
    await client.updateComment(issueInfo.owner, issueInfo.repo, sync.comment_id, localContent)
  } else {
    // Create new comment
    const comment = await client.createComment(
      issueInfo.owner,
      issueInfo.repo,
      issueInfo.issue_number,
      localContent,
    )
    sync.comment_id = comment.id
  }

  // Update config
  sync.last_synced_hash = localHash
  sync.last_synced_at = new Date().toISOString()
  saveConfig(state, cwd)
}
