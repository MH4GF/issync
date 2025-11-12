import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SyncSelector } from '../lib/config.js'
import { loadConfig, saveConfig, selectSync } from '../lib/config.js'
import { LocalChangeError, SyncNotFoundError } from '../lib/errors.js'
import { createGitHubClient, parseIssueUrl, removeMarker } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import { resolveFilePath } from '../lib/path.js'
import { reportSyncResults } from '../lib/sync-reporter.js'
import type { IssyncState, IssyncSync, PullOptions } from '../types/index.js'

/**
 * Pull a single sync from remote
 * @returns true if content was updated, false if no changes
 */
async function pullSingleSync(
  sync: IssyncSync,
  cwd: string,
  token?: string,
  force?: boolean,
): Promise<boolean> {
  const baseDir = cwd ?? process.cwd()

  if (!sync.comment_id) {
    throw new Error(
      'No comment_id found in config. Please run "issync push" first to create a comment.',
    )
  }

  // Validate file path
  const basePath = path.resolve(baseDir)
  const resolvedPath = resolveFilePath(basePath, sync.local_file)

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

  // Unwrap markers from remote content
  const remoteContent = removeMarker(comment.body)

  // Calculate hash of remote content
  const remoteHash = calculateHash(remoteContent)

  // Early return if remote unchanged
  if (remoteHash === sync.last_synced_hash) {
    if (process.env.ISSYNC_DEBUG) {
      console.log(`[DEBUG] Skipping pull for ${sync.local_file}: content unchanged`)
    }
    return false
  }

  // Check for local changes (if file exists and not forced)
  if (existsSync(resolvedPath) && !force) {
    const localContent = readFileSync(resolvedPath, 'utf-8')
    const localHash = calculateHash(localContent)

    // If local file differs from last synced state, abort pull
    if (localHash !== sync.last_synced_hash) {
      throw new LocalChangeError(resolvedPath, localHash, remoteHash, sync.last_synced_hash)
    }
  }

  // Write to local file (without markers)
  await writeFile(resolvedPath, remoteContent, 'utf-8')

  // Update sync metadata
  sync.last_synced_hash = remoteHash
  sync.last_synced_at = new Date().toISOString()

  return true
}

/**
 * Pull all syncs in parallel and report results
 * @returns true if any sync was updated, false if no changes
 */
async function pullAllSyncs(
  state: IssyncState,
  baseDir: string,
  cwd: string | undefined,
  token?: string,
  force?: boolean,
): Promise<boolean> {
  if (state.syncs.length === 0) {
    throw new SyncNotFoundError()
  }

  // Pull all syncs in parallel
  const results = await Promise.allSettled(
    state.syncs.map((sync) => pullSingleSync(sync, baseDir, token, force)),
  )

  // Collect failures and check if any sync was updated
  let hasChanges = false

  const failures = results
    .map((result, index) => {
      if (result.status === 'fulfilled') {
        hasChanges ||= result.value
        return null
      }
      return { sync: state.syncs[index], reason: result.reason }
    })
    .filter((failure): failure is { sync: IssyncSync; reason: unknown } => failure !== null)

  // Save config (updates successful syncs)
  saveConfig(state, cwd)

  // Report results
  reportSyncResults('pull', state.syncs.length, failures)

  return hasChanges
}

/**
 * Pull from remote to local file(s)
 * @returns true if any content was updated, false if no changes
 */
export async function pull(options: PullOptions = {}): Promise<boolean> {
  const { cwd, token, file, issue, force } = options
  const baseDir = cwd ?? process.cwd()

  // Load config
  const state = loadConfig(cwd)

  // If no selector provided, pull all syncs
  if (!file && !issue) {
    return pullAllSyncs(state, baseDir, cwd, token, force)
  }

  // Single sync pull
  const selector: SyncSelector = {
    file,
    issueUrl: issue,
  }
  const { sync } = selectSync(state, selector, baseDir)

  const hasChanges = await pullSingleSync(sync, baseDir, token, force)
  saveConfig(state, cwd)

  return hasChanges
}
