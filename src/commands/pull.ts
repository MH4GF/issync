import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SyncSelector } from '../lib/config.js'
import { loadConfig, saveConfig, selectSync } from '../lib/config.js'
import { createGitHubClient, parseIssueUrl } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import { resolvePathWithinBase } from '../lib/path.js'

export interface PullOptions {
  cwd?: string
  token?: string
  file?: string
  issue?: string
}

export async function pull(options: PullOptions = {}): Promise<void> {
  const { cwd, token, file, issue } = options
  const baseDir = cwd ?? process.cwd()

  // Load config
  const state = loadConfig(cwd)
  const selector: SyncSelector = {
    file,
    issueUrl: issue,
  }
  const { sync } = selectSync(state, selector, baseDir)

  if (!sync.comment_id) {
    throw new Error(
      'No comment_id found in config. Please run "issync push" first to create a comment.',
    )
  }

  // Validate file path
  const basePath = path.resolve(baseDir)
  const resolvedPath = resolvePathWithinBase(basePath, sync.local_file, sync.local_file)

  // Ensure parent directory exists
  const parentDir = path.dirname(resolvedPath)
  if (!existsSync(parentDir)) {
    await mkdir(parentDir, { recursive: true })
  }

  // Parse issue URL
  const issueInfo = parseIssueUrl(sync.issue_url)

  // Fetch comment from GitHub
  const client = createGitHubClient(token)
  const comment = await client.getComment(issueInfo.owner, issueInfo.repo, sync.comment_id)

  // Calculate hash of remote content
  const remoteHash = calculateHash(comment.body)

  // Write to local file
  await writeFile(resolvedPath, comment.body, 'utf-8')

  // Update config with new hash
  sync.last_synced_hash = remoteHash
  sync.last_synced_at = new Date().toISOString()
  saveConfig(state, cwd)
}
