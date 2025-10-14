import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import { loadConfig, selectSync } from '../lib/config.js'
import {
  AmbiguousSyncError,
  ConfigNotFoundError,
  InvalidFilePathError,
  SyncNotFoundError,
} from '../lib/errors.js'
import { createGitHubClient, parseIssueUrl } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import type { IssyncState, IssyncSync } from '../types/index.js'
import { pull } from './pull.js'
import { OptimisticLockError, push } from './push.js'

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

interface WatchOptions {
  interval?: number // polling interval in seconds
  cwd?: string
  file?: string
  issue?: string
}

// Constants
const DEFAULT_POLL_INTERVAL_SECONDS = 10
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 60000
const FILE_STABILITY_THRESHOLD_MS = 500
const FILE_POLL_INTERVAL_MS = 100
/**
 * Grace period to ignore file changes after pull completion.
 * This prevents pull-push loops where chokidar detects file changes
 * made by pull() itself.
 *
 * Value rationale:
 * - chokidar's awaitWriteFinish uses 500ms stability threshold
 * - Adding 500ms buffer for OS I/O delays
 * - Total: 1000ms provides safe margin while being short enough
 *   to not significantly delay legitimate user edits
 */
const PULL_GRACE_PERIOD_MS = 1000

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
 */
export async function _performSafetyCheck(
  sync: IssyncSync,
  cwd = process.cwd(),
  resolvedFilePath?: string,
): Promise<void> {
  if (!sync.comment_id) {
    throw new Error(
      'No comment_id found in config. Please run "issync push" first to create a comment.',
    )
  }

  const lastSyncedHash = sync.last_synced_hash
  const localFilePath = resolvedFilePath ?? resolveLocalFilePath(sync.local_file, cwd)

  if (!lastSyncedHash) {
    console.log(
      '⚠️  No sync history found. Pulling from remote to establish baseline before starting watch...',
    )
    await pull({ cwd, file: sync.local_file })
    console.log('✓ Baseline established from remote')
    return
  }

  // Read local file
  if (!existsSync(localFilePath)) {
    console.log('⚠️  Local file missing. Pulling from remote to restore before starting watch...')
    await pull({ cwd, file: sync.local_file })
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
    await push({ cwd, file: sync.local_file })
    console.log('✓ Local changes pushed')
  } else if (remoteChanged) {
    // Only remote changed → Auto pull
    console.log('⚠️  Remote changes detected. Pulling from remote before starting watch...')
    await pull({ cwd, file: sync.local_file })
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
): Promise<Array<{ sync: IssyncSync; resolvedPath: string }>> {
  const state = loadConfig(cwd)
  const syncs = determineSyncs(state, options, cwd)

  if (syncs.length === 0) {
    throw new SyncNotFoundError()
  }

  const targets = syncs.map((sync) => ({
    sync,
    resolvedPath: resolveLocalFilePath(sync.local_file, cwd),
  }))

  for (const target of targets) {
    await _performSafetyCheck(target.sync, cwd, target.resolvedPath)
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
 * Manages a watch session that syncs local files with remote GitHub Issue comments
 */
class WatchSession {
  private isShuttingDown = false
  private operationLock: Promise<void> | null = null
  private fileWatcher: FSWatcher | null = null
  private consecutiveErrors = 0
  private nextAllowedPollTime = 0
  private shutdownResolve: (() => void) | null = null
  private pollingAbortController: AbortController | null = null
  private lastPullCompletedAt = 0

  constructor(
    private readonly sync: IssyncSync,
    private readonly filePath: string,
    private readonly intervalMs: number,
    private readonly cwd: string,
    readonly _skipInitialPull: boolean = false,
  ) {}

  /**
   * Start the watch session
   */
  async start(): Promise<void> {
    // Validate file exists before starting (fail-fast)
    if (!existsSync(this.filePath)) {
      throw new Error(`Local file does not exist: ${this.filePath}`)
    }

    console.log('Starting watch mode...')
    console.log(`  File:     ${this.filePath}`)
    console.log(`  Interval: ${this.intervalMs / 1000}s`)
    console.log('  ⚠️  Before editing locally, ensure remote is up-to-date:')
    console.log("      Run `issync pull` if you're unsure")
    console.log('  ⚠️  If conflicts occur, watch mode will notify you')
    console.log('  Press Ctrl+C to stop\n')

    // Setup graceful shutdown
    const shutdownPromise = this.setupShutdownHandlers()

    // Start remote polling (performs initial pull synchronously)
    await this.startRemotePolling()

    // Start local file watching
    this.startFileWatching()

    // Wait for shutdown signal
    await shutdownPromise
  }

  /**
   * Stop the watch session
   */
  private async stop(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    console.log('\n\nShutting down watch mode...')

    // Stop polling
    if (this.pollingAbortController) {
      this.pollingAbortController.abort()
      this.pollingAbortController = null
    }

    // Stop file watcher
    if (this.fileWatcher) {
      await this.fileWatcher.close()
      this.fileWatcher = null
    }

    console.log('✓ Watch mode stopped')
    if (this.shutdownResolve) {
      this.shutdownResolve()
    }
  }

  /**
   * Calculate exponential backoff and log warning
   */
  private calculateBackoff(): void {
    this.consecutiveErrors++
    const backoffMs = Math.min(2 ** this.consecutiveErrors * BACKOFF_BASE_MS, BACKOFF_MAX_MS)
    this.nextAllowedPollTime = Date.now() + backoffMs

    if (this.consecutiveErrors > 1) {
      console.error(
        `⚠️  Backing off for ${backoffMs / 1000}s after ${this.consecutiveErrors} consecutive errors`,
      )
    }
  }

  /**
   * Executes an operation with a lock to prevent concurrent operations
   */
  private async withLock(fn: () => Promise<void>): Promise<void> {
    if (this.operationLock || this.isShuttingDown) return

    this.operationLock = fn()
      .then(() => {
        this.consecutiveErrors = 0
        this.nextAllowedPollTime = 0
      })
      .catch((error) => {
        this.calculateBackoff()
        throw error
      })
      .finally(() => {
        this.operationLock = null
      })

    await this.operationLock
  }

  private setupShutdownHandlers(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.shutdownResolve = resolve

      const shutdown = () => {
        void this.stop()
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    })
  }

  /**
   * Execute a single poll: check backoff, pull from remote, and handle errors
   */
  private async pollOnce(): Promise<void> {
    // Check backoff
    if (Date.now() < this.nextAllowedPollTime) return

    try {
      await this.withLock(async () => {
        await pull({ cwd: this.cwd, file: this.sync.local_file })
        this.lastPullCompletedAt = Date.now() // Record pull completion time
        console.log(`[${new Date().toISOString()}] ✓ Pulled changes from remote`)
      })
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[${new Date().toISOString()}] Pull error: ${error.message}`)
      }
    }
  }

  /**
   * Run the polling loop in background
   */
  private async runPollingLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.sleep(this.intervalMs, signal)
      } catch {
        // Aborted during sleep
        break
      }

      if (signal.aborted) break
      await this.pollOnce()
    }
  }

  private async startRemotePolling(): Promise<void> {
    console.log('Starting remote polling...')

    this.pollingAbortController = new AbortController()
    const signal = this.pollingAbortController.signal

    // Initial pull (synchronous, throws on error) - skip if already synced by safety check
    if (!this._skipInitialPull) {
      try {
        await pull({ cwd: this.cwd, file: this.sync.local_file })
        this.lastPullCompletedAt = Date.now() // Record initial pull completion time
        console.log('✓ Initial pull completed')
      } catch (error) {
        if (error instanceof ConfigNotFoundError) {
          console.error('Config not found. Please run "issync init" first.')
          throw error
        }
        if (error instanceof Error) {
          console.error(`Initial pull failed: ${error.message}`)
          console.error('Cannot start watch mode - please ensure remote is accessible')
          throw error
        }
        throw error
      }
    } else {
      // Safety check already synced, just update timestamp
      this.lastPullCompletedAt = Date.now()
      console.log('✓ Already synced by safety check')
    }

    // Run polling loop in background
    void this.runPollingLoop(signal)
  }

  private startFileWatching(): void {
    console.log('Starting file watcher...')

    this.fileWatcher = chokidar.watch(this.filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: FILE_STABILITY_THRESHOLD_MS,
        pollInterval: FILE_POLL_INTERVAL_MS,
      },
    })

    this.fileWatcher.on('change', () => {
      void this.handleFileChange()
    })

    this.fileWatcher.on('error', (error: unknown) => {
      console.error('File watcher error:', error)
    })

    console.log('✓ Watch mode started\n')
  }

  private async handleFileChange(): Promise<void> {
    // Skip if this change is likely from a recent pull (prevents pull-push loop)
    const timeSinceLastPull = Date.now() - this.lastPullCompletedAt
    if (timeSinceLastPull < PULL_GRACE_PERIOD_MS) {
      const remainingMs = PULL_GRACE_PERIOD_MS - timeSinceLastPull
      console.log(
        `[${new Date().toISOString()}] ⚠️  File change detected ${timeSinceLastPull}ms after pull (within grace period). ` +
          `This is likely from the pull operation and will be ignored. ` +
          `If you just edited the file, please save again in ${Math.ceil(remainingMs / 1000)}s.`,
      )
      return
    }

    console.log(`[${new Date().toISOString()}] File changed, pushing...`)

    try {
      await this.withLock(async () => {
        await push({ cwd: this.cwd, file: this.sync.local_file })
        console.log(`[${new Date().toISOString()}] ✓ Pushed changes to remote`)
      })
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        console.error(
          `[${new Date().toISOString()}] ⚠️  Conflict detected: Remote was modified. Run "issync pull" to sync.`,
        )
      } else if (error instanceof Error) {
        console.error(`[${new Date().toISOString()}] Push error: ${error.message}`)
      }
    }
  }

  /**
   * Sleep for a duration or until aborted
   */
  private async sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw new Error('Aborted')

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, ms)
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout)
          reject(new Error('Aborted'))
        },
        { once: true },
      )
    })
  }
}

export async function watch(options: WatchOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const intervalSeconds = options.interval ?? DEFAULT_POLL_INTERVAL_SECONDS
  const intervalMs = intervalSeconds * 1000

  let targets: Array<{ sync: IssyncSync; resolvedPath: string }>
  try {
    targets = await prepareTargets(options, cwd)
  } catch (error) {
    handleWatchSetupError(error)
    throw error
  }

  const targetCount = targets.length
  const plural = targetCount === 1 ? '' : 's'
  console.log(`Starting watch mode for ${targetCount} sync target${plural}`)

  const sessions = targets.map(
    ({ sync, resolvedPath }) => new WatchSession(sync, resolvedPath, intervalMs, cwd, true),
  )

  // Use Promise.allSettled to handle individual session failures
  // Design decision: Partial failure mode is enabled - if some sessions succeed,
  // watch mode continues running with those successful sessions. This allows users
  // to work with syncs that succeeded while investigating failures.
  const results = await Promise.allSettled(sessions.map((session) => session.start()))

  const failures: Array<{ index: number; reason: unknown }> = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failures.push({ index, reason: result.reason })
    }
  })

  if (failures.length > 0) {
    const successCount = sessions.length - failures.length
    const message = `${failures.length} of ${sessions.length} watch session(s) failed to start`
    console.error(`\nError: ${message}`)

    for (const { index, reason } of failures) {
      const target = targets[index]
      const sync = target.sync
      const label = `${sync.issue_url} → ${sync.local_file}`
      const errorMsg = reason instanceof Error ? reason.message : String(reason)
      console.error(`  ${label}: ${errorMsg}`)
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
}
