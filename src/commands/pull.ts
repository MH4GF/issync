import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig, saveConfig } from '../lib/config.js'
import { GitHubClient, parseIssueUrl } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'

export interface PullOptions {
  cwd?: string
  token?: string
}

export async function pull(options: PullOptions = {}): Promise<void> {
  const { cwd, token } = options

  // Load config
  const config = loadConfig(cwd)

  if (!config.comment_id) {
    throw new Error(
      'No comment_id found in config. Please run "issync push" first to create a comment.',
    )
  }

  // Parse issue URL
  const issueInfo = parseIssueUrl(config.issue_url)

  // Fetch comment from GitHub
  const client = new GitHubClient(token)
  const comment = await client.getComment(issueInfo.owner, issueInfo.repo, config.comment_id)

  // Calculate hash of remote content
  const remoteHash = calculateHash(comment.body)

  // Write to local file
  const filePath = path.join(cwd || process.cwd(), config.local_file)
  await writeFile(filePath, comment.body, 'utf-8')

  // Update config with new hash
  config.last_synced_hash = remoteHash
  config.last_synced_at = new Date().toISOString()
  saveConfig(config, cwd)
}
