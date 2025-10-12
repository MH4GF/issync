import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config.js'
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

  // Read local file
  const filePath = path.join(cwd || process.cwd(), config.local_file)
  const localContent = await readFile(filePath, 'utf-8')
  const localHash = calculateHash(localContent)

  // Parse issue URL
  const issueInfo = parseIssueUrl(config.issue_url)

  // Initialize GitHub client
  const client = new GitHubClient(token)

  if (config.comment_id) {
    // Update existing comment with optimistic locking
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
