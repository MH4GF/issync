import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SyncSelector } from '../lib/config.js'
import { loadConfig, saveConfig, selectSync } from '../lib/config.js'
import { SyncNotFoundError } from '../lib/errors.js'
import { createGitHubClient, parseIssueUrl, unwrapMarkers } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import { resolvePathWithinBase } from '../lib/path.js'
import { reportSyncResults } from '../lib/sync-reporter.js'
import type { IssyncState, IssyncSync } from '../types/index.js'

export interface PullOptions {
  cwd?: string
  token?: string
  file?: string
  issue?: string
}

/**
 * Pull a single sync from remote
 */
async function pullSingleSync(sync: IssyncSync, cwd: string, token?: string): Promise<void> {
  const baseDir = cwd ?? process.cwd()

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

  // Unwrap markers from remote content
  const remoteContent = unwrapMarkers(comment.body)

  // Calculate hash of remote content
  const remoteHash = calculateHash(remoteContent)

  // Write to local file (without markers)
  await writeFile(resolvedPath, remoteContent, 'utf-8')

  // Update sync metadata
  sync.last_synced_hash = remoteHash
  sync.last_synced_at = new Date().toISOString()
}

/**
 * Pull all syncs in parallel and report results
 */
async function pullAllSyncs(
  state: IssyncState,
  baseDir: string,
  cwd: string,
  token?: string,
): Promise<void> {
  if (state.syncs.length === 0) {
    throw new SyncNotFoundError()
  }

  // Pull all syncs in parallel
  const results = await Promise.allSettled(
    state.syncs.map((sync) => pullSingleSync(sync, baseDir, token)),
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
  reportSyncResults('pull', state.syncs.length, failures)
}

export async function pull(options: PullOptions = {}): Promise<void> {
  const { cwd, token, file, issue } = options
  const baseDir = cwd ?? process.cwd()

  // Load config
  const state = loadConfig(cwd)

  // If no selector provided, pull all syncs
  if (!file && !issue) {
    await pullAllSyncs(state, baseDir, baseDir, token)
    return
  }

  // Single sync pull
  const selector: SyncSelector = {
    file,
    issueUrl: issue,
  }
  const { sync } = selectSync(state, selector, baseDir)

  await pullSingleSync(sync, baseDir, token)
  saveConfig(state, cwd)
}
