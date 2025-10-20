import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { loadConfig, resolveConfigPath, resolveCwdForScope, selectSync } from '../lib/config.js'
import {
  AmbiguousSyncError,
  ConfigNotFoundError,
  InvalidFilePathError,
  SyncNotFoundError,
} from '../lib/errors.js'
import { createGitHubClient, parseIssueUrl } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import type { ConfigScope, IssyncState, IssyncSync, SelectorOptions } from '../types/index.js'
import { pull } from './pull.js'
import { push } from './push.js'
import {
  formatError,
  reportPreparationFailures,
  reportSessionStartupFailures,
} from './watch/errorReporter.js'
import { SessionManager } from './watch/SessionManager.js'
import { StateFileWatcher } from './watch/StateFileWatcher.js'

/**
 * Error thrown when both local and remote have changes since last sync
 */
class ConflictError extends Error {
  constructor() {
    super(
      '❌ Cannot start watch: CONFLICT DETECTED\n' +
        'Both local and remote have changes since last sync.\n' +
        'Please manually resolve the conflict:\n' +
        '  1. Review differences: Compare local file with remote\n' +
        '  2. Force pull: issync pull (discards local changes)\n' +
        '  3. Force push: issync push (overwrites remote)\n',
    )
    this.name = 'ConflictError'
  }
}

interface WatchOptions extends SelectorOptions {
  interval?: number // polling interval in seconds
}

/**
 * A target prepared for watching with resolved path and sync configuration
 */
type PreparedTarget = {
  sync: IssyncSync
  resolvedPath: string
}

// Constants
const DEFAULT_POLL_INTERVAL_SECONDS = 30

/**
 * Resolve and validate local file path to prevent directory traversal attacks
 *
 * This function ensures that the resolved path is within the project directory (cwd)
 * and cannot escape to parent directories using patterns like "../../../etc/passwd".
 *
 * Security: Validates against path traversal attacks by checking that the resolved
 * absolute path starts with the base directory path.
 *
 * @param localFile - The local file path from sync configuration
 * @param cwd - The current working directory (base path)
 * @returns Validated absolute file path
 * @throws {InvalidFilePathError} If path traversal is detected
 *
 * @example
 * ```typescript
 * // Valid: resolves to /project/.issync/docs/plan.md
 * resolveLocalFilePath('.issync/docs/plan.md', '/project')
 *
 * // Invalid: throws InvalidFilePathError
 * resolveLocalFilePath('../../../etc/passwd', '/project')
 * ```
 */
function resolveLocalFilePath(localFile: string, cwd: string): string {
  const basePath = path.resolve(cwd)
  const resolvedPath = path.resolve(basePath, localFile)

  if (!resolvedPath.startsWith(basePath)) {
    throw new InvalidFilePathError(localFile, 'path traversal detected')
  }

  return resolvedPath
}

/**
 * Perform 3-way comparison to detect conflicts before starting watch
 * Returns true if safety check passed (watch can start)
 * Exported for testing
 *
 * NOTE: The scope parameter ensures consistency - all pull/push operations during
 * safety check use the same config scope as the watch command itself.
 * If scope is undefined, the auto-detection logic in resolveConfigPath() applies.
 */
export async function _performSafetyCheck(
  sync: IssyncSync,
  cwd = process.cwd(),
  resolvedFilePath?: string,
  scope?: ConfigScope,
): Promise<void> {
  if (!sync.comment_id) {
    throw new Error(
      `No comment_id found for sync "${sync.issue_url}". ` +
        `Please run "issync push" for this sync before starting watch mode.`,
    )
  }

  const lastSyncedHash = sync.last_synced_hash
  const localFilePath = resolvedFilePath ?? resolveLocalFilePath(sync.local_file, cwd)

  if (!lastSyncedHash) {
    console.log(
      '⚠️  No sync history found. Pulling from remote to establish baseline before starting watch...',
    )
    await pull({ cwd, file: sync.local_file, scope })
    console.log('✓ Baseline established from remote')
    return
  }

  // Read local file
  if (!existsSync(localFilePath)) {
    console.log('⚠️  Local file missing. Pulling from remote to restore before starting watch...')
    await pull({ cwd, file: sync.local_file, scope })
    console.log('✓ Local file restored from remote')
    return
  }
  const localContent = readFileSync(localFilePath, 'utf-8')
  const localHash = calculateHash(localContent)

  // Fetch remote content
  const client = createGitHubClient()
  const { owner, repo } = parseIssueUrl(sync.issue_url)
  const comment = await client.getComment(owner, repo, sync.comment_id)
  const remoteHash = calculateHash(comment.body)

  // 3-way comparison
  const localChanged = localHash !== lastSyncedHash
  const remoteChanged = remoteHash !== lastSyncedHash

  if (localChanged && remoteChanged) {
    // Both sides changed → Conflict
    throw new ConflictError()
  }

  if (localChanged) {
    // Only local changed → Auto push
    console.log('⚠️  Local changes detected. Pushing to remote before starting watch...')
    // NOTE: Use the same scope as watch command to maintain config consistency
    await push({ cwd, file: sync.local_file, scope })
    console.log('✓ Local changes pushed')
  } else if (remoteChanged) {
    // Only remote changed → Auto pull
    console.log('⚠️  Remote changes detected. Pulling from remote before starting watch...')
    // NOTE: Use the same scope as watch command to maintain config consistency
    await pull({ cwd, file: sync.local_file, scope })
    console.log('✓ Remote changes pulled')
  }
  // else: Neither changed → No-op, proceed to watch
}

function determineSyncs(state: IssyncState, options: WatchOptions, cwd: string): IssyncSync[] {
  if (options.file || options.issue) {
    const { sync } = selectSync(state, { file: options.file, issueUrl: options.issue }, cwd)
    return [sync]
  }
  return state.syncs
}

async function prepareTargets(
  options: WatchOptions,
  cwd: string,
  resolvedCwd: string | undefined,
  scope?: ConfigScope,
): Promise<PreparedTarget[]> {
  const state = loadConfig(scope, resolvedCwd)
  const syncs = determineSyncs(state, options, cwd)

  if (syncs.length === 0) {
    throw new SyncNotFoundError()
  }

  const targets: PreparedTarget[] = syncs.map((sync) => ({
    sync,
    resolvedPath: resolveLocalFilePath(sync.local_file, cwd),
  }))

  for (const target of targets) {
    await _performSafetyCheck(target.sync, cwd, target.resolvedPath, scope)
  }

  return targets
}

function handleWatchSetupError(error: unknown): void {
  if (error instanceof ConfigNotFoundError) {
    console.error('Config not found. Please run "issync init" first.')
    return
  }
  if (error instanceof AmbiguousSyncError) {
    console.error(error.message)
    return
  }
  if (error instanceof SyncNotFoundError) {
    console.error(error.message)
    return
  }
  if (error instanceof InvalidFilePathError) {
    console.error(error.message)
    return
  }
  if (error instanceof ConflictError) {
    return
  }
  if (error instanceof Error) {
    console.error(`Initial sync failed: ${error.message}`)
    console.error('Cannot start watch mode - please ensure remote is accessible')
  }
}

/**
 * Find syncs that are not currently being watched
 *
 * Compares the current state from state.yml against the set of tracked issue URLs
 * to identify new syncs that need to be added to watch mode.
 *
 * @param currentState - The current state loaded from state.yml
 * @param trackedIssueUrls - Set of issue URLs currently being watched
 * @returns Array of syncs that need to be added to watch mode
 *
 * @example
 * ```typescript
 * const state = loadConfig(cwd)
 * const tracked = new Set(['https://github.com/owner/repo/issues/1'])
 * const newSyncs = findUnwatchedSyncs(state, tracked)
 * console.log(`Found ${newSyncs.length} new sync(s)`)
 * ```
 */
function findUnwatchedSyncs(
  currentState: IssyncState,
  trackedIssueUrls: Set<string>,
): IssyncSync[] {
  return currentState.syncs.filter((sync) => !trackedIssueUrls.has(sync.issue_url))
}

/**
 * Prepare new targets with safety checks in parallel
 * @param newSyncs Array of syncs to prepare
 * @param cwd Current working directory
 * @returns Array of successfully prepared targets
 */
async function prepareNewTargets(
  newSyncs: IssyncSync[],
  cwd: string,
  scope?: ConfigScope,
): Promise<PreparedTarget[]> {
  const results = await Promise.allSettled(
    newSyncs.map(async (sync) => {
      const resolvedPath = resolveLocalFilePath(sync.local_file, cwd)
      await _performSafetyCheck(sync, cwd, resolvedPath, scope)
      return { sync, resolvedPath }
    }),
  )

  const prepared: PreparedTarget[] = []
  const failures: Array<{ sync: IssyncSync; error: string }> = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      prepared.push(result.value)
    } else {
      failures.push({ sync: newSyncs[index], error: formatError(result.reason) })
    }
  })

  reportPreparationFailures(failures)

  return prepared
}

/**
 * Detect new syncs and start watch sessions for them
 * @returns Object containing success count and failure information
 */
async function detectAndStartNewSessions(
  cwd: string,
  intervalMs: number,
  sessionManager: SessionManager,
  resolvedCwd: string | undefined,
  scope?: ConfigScope,
): Promise<{
  successCount: number
  failures: Array<{ target: PreparedTarget; error: unknown }>
}> {
  const trackedIssueUrls = sessionManager.getTrackedUrls()
  const currentState = loadConfig(scope, resolvedCwd)
  const newSyncs = findUnwatchedSyncs(currentState, trackedIssueUrls)

  if (newSyncs.length === 0) {
    return { successCount: 0, failures: [] }
  }

  const newTargets = await prepareNewTargets(newSyncs, cwd, scope)
  if (newTargets.length === 0) {
    return { successCount: 0, failures: [] }
  }

  const results = await Promise.allSettled(
    newTargets.map(({ sync, resolvedPath }) =>
      sessionManager.startSession(sync, resolvedPath, intervalMs, cwd, true),
    ),
  )

  const failures = results
    .map((r, i) => ({ result: r, index: i }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ result, index }) => ({
      target: newTargets[index],
      error: (result as PromiseRejectedResult).reason,
    }))

  const successCount = results.length - failures.length

  return { successCount, failures }
}

/**
 * Handle state.yml change event by detecting new syncs and starting new watch sessions
 */
async function handleStateChange(
  cwd: string,
  intervalMs: number,
  sessionManager: SessionManager,
  resolvedCwd: string | undefined,
  scope?: ConfigScope,
): Promise<void> {
  try {
    console.log(`\n[${new Date().toISOString()}] state.yml changed, checking for new syncs...`)

    const { successCount, failures } = await detectAndStartNewSessions(
      cwd,
      intervalMs,
      sessionManager,
      resolvedCwd,
      scope,
    )

    if (successCount === 0 && failures.length === 0) {
      console.log('No new syncs detected')
      return
    }

    // Report results
    reportSessionStartupFailures(failures)

    if (successCount > 0) {
      console.log(`✓ ${successCount} new session(s) started successfully`)
    }
  } catch (error) {
    console.error(`Error handling state.yml change: ${formatError(error)}`)
  }
}

export async function watch(options: WatchOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const scope = options.scope
  const resolvedCwd = resolveCwdForScope(scope, cwd)
  const intervalSeconds = options.interval ?? DEFAULT_POLL_INTERVAL_SECONDS
  const intervalMs = intervalSeconds * 1000

  let targets: PreparedTarget[]
  try {
    targets = await prepareTargets(options, cwd, resolvedCwd, scope)
  } catch (error) {
    handleWatchSetupError(error)
    throw error
  }

  const targetCount = targets.length
  const plural = targetCount === 1 ? '' : 's'
  console.log(`Starting watch mode for ${targetCount} sync target${plural}`)

  // Initialize session manager
  const sessionManager = new SessionManager()

  // Use Promise.allSettled to handle individual session failures
  // Design decision: Partial failure mode is enabled - if some sessions succeed,
  // watch mode continues running with those successful sessions. This allows users
  // to work with syncs that succeeded while investigating failures.
  const results = await Promise.allSettled(
    targets.map(({ sync, resolvedPath }) =>
      sessionManager.startSession(sync, resolvedPath, intervalMs, cwd, true),
    ),
  )

  const failures: Array<{ index: number; reason: unknown }> = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failures.push({ index, reason: result.reason })
    }
  })

  if (failures.length > 0) {
    const successCount = targets.length - failures.length
    const message = `${failures.length} of ${targets.length} watch session(s) failed to start`
    console.error(`\nError: ${message}`)

    for (const { index, reason } of failures) {
      const target = targets[index]
      const sync = target.sync
      const label = `${sync.issue_url} → ${sync.local_file}`
      console.error(`  ${label}: ${formatError(reason)}`)
    }

    // If some sessions succeeded, show success count and continue
    if (successCount > 0) {
      console.log(`\n✓ ${successCount} session(s) started successfully`)
      console.warn('\nWarning: Some syncs failed. Run `issync status` to check sync state.')
    } else {
      // All sessions failed - throw error
      throw new Error('All watch sessions failed to start')
    }
  }

  // Setup state.yml monitoring for dynamic sync addition
  const { stateFile } = resolveConfigPath(scope)
  console.log('\nMonitoring state.yml for new sync entries...')

  const stateFileWatcher = new StateFileWatcher(stateFile, async () => {
    await handleStateChange(cwd, intervalMs, sessionManager, resolvedCwd, scope)
  })

  stateFileWatcher.start()

  // Setup shutdown handler to close all sessions and state watcher
  let isCleaningUp = false
  const cleanup = async (signal: string) => {
    if (isCleaningUp) return
    isCleaningUp = true

    console.log(`\nReceived ${signal}, cleaning up all watch sessions...`)

    // Note: failures are logged internally by SessionManager.stopAll()
    await sessionManager.stopAll()

    await stateFileWatcher.stop()

    // Allow tests to mock process.exit
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0)
    }
  }

  process.once('SIGINT', () => void cleanup('SIGINT'))
  process.once('SIGTERM', () => void cleanup('SIGTERM'))

  // Wait indefinitely for shutdown signal (unless in test environment)
  if (process.env.NODE_ENV !== 'test') {
    await new Promise(() => {
      // This promise never resolves - wait for SIGINT/SIGTERM
    })
  }
}
