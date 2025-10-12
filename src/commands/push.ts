import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config.js'
import { FileNotFoundError, InvalidFilePathError } from '../lib/errors.js'
import { GitHubClient, parseIssueUrl } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'

export interface PushOptions {
  cwd?: string
  token?: string
}

export class OptimisticLockError extends Error {
  constructor() {
    super('Remote comment has been updated since last sync. Please run "issync pull" first.')
    this.name = 'OptimisticLockError'
  }
}

export async function push(options: PushOptions = {}): Promise<void> {
  const { cwd, token } = options

  // Load config
  const config = loadConfig(cwd)

  // Validate and read local file
  const filePath = path.join(cwd || process.cwd(), config.local_file)

  // Check for path traversal
  const resolvedPath = path.resolve(cwd || process.cwd(), config.local_file)
  const basePath = path.resolve(cwd || process.cwd())
  if (!resolvedPath.startsWith(basePath)) {
    throw new InvalidFilePathError(config.local_file, 'path traversal detected')
  }

  // Check if file exists
  if (!existsSync(filePath)) {
    throw new FileNotFoundError(filePath)
  }

  const localContent = await readFile(filePath, 'utf-8')
  const localHash = calculateHash(localContent)

  // Parse issue URL
  const issueInfo = parseIssueUrl(config.issue_url)

  // Initialize GitHub client
  const client = new GitHubClient(token)

  if (config.comment_id) {
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
    const remoteComment = await client.getComment(
      issueInfo.owner,
      issueInfo.repo,
      config.comment_id,
    )
    const remoteHash = calculateHash(remoteComment.body)

    // Check if remote has been updated since last sync
    if (config.last_synced_hash && remoteHash !== config.last_synced_hash) {
      throw new OptimisticLockError()
    }

    // Update comment
    await client.updateComment(issueInfo.owner, issueInfo.repo, config.comment_id, localContent)
  } else {
    // Create new comment
    const comment = await client.createComment(
      issueInfo.owner,
      issueInfo.repo,
      issueInfo.issue_number,
      localContent,
    )
    config.comment_id = comment.id
  }

  // Update config
  config.last_synced_hash = localHash
  config.last_synced_at = new Date().toISOString()
  saveConfig(config, cwd)
}
