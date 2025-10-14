import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SyncSelector } from '../lib/config.js'
import { loadConfig, saveConfig, selectSync } from '../lib/config.js'
import { SyncNotFoundError } from '../lib/errors.js'
import { createGitHubClient, parseIssueUrl } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import { resolvePathWithinBase } from '../lib/path.js'
import type { IssyncSync } from '../types/index.js'

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

  // Calculate hash of remote content
  const remoteHash = calculateHash(comment.body)

  // Write to local file
  await writeFile(resolvedPath, comment.body, 'utf-8')

  // Update sync metadata
  sync.last_synced_hash = remoteHash
  sync.last_synced_at = new Date().toISOString()
}

/**
 * Pull all syncs in parallel and report results
 */
async function pullAllSyncs(
  state: import('../types/index.js').IssyncState,
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
  const failures: Array<{ index: number; sync: IssyncSync; reason: unknown }> = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failures.push({ index, sync: state.syncs[index], reason: result.reason })
    }
  })

  // Save config (updates successful syncs)
  saveConfig(state, cwd)

  // Report results
  if (failures.length > 0) {
    const successCount = state.syncs.length - failures.length
    const message = `${failures.length} of ${state.syncs.length} pull operation(s) failed`
    console.error(`\nError: ${message}`)

    for (const { sync, reason } of failures) {
      const label = `${sync.issue_url} → ${sync.local_file}`
      const errorMsg = reason instanceof Error ? reason.message : String(reason)
      console.error(`  ${label}: ${errorMsg}`)
    }

    if (successCount > 0) {
      console.log(`\n✓ ${successCount} sync(s) pulled successfully`)
    }

    throw new Error(message)
  }

  console.log(`✓ Successfully pulled ${state.syncs.length} sync(s)`)
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
