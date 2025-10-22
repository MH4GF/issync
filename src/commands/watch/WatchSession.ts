import { existsSync } from 'node:fs'
import chokidar, { type FSWatcher } from 'chokidar'
import { ConfigNotFoundError } from '../../lib/errors.js'
import type { ConfigScope, IssyncSync } from '../../types/index.js'
import { pull } from '../pull.js'
import { OptimisticLockError, push } from '../push.js'

// Constants
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

/**
 * Manages a watch session that syncs local files with remote GitHub Issue comments
 */
export class WatchSession {
  private isShuttingDown = false
  private shutdownPromise: Promise<void> | null = null
  private operationLock: Promise<void> | null = null
  private fileWatcher: FSWatcher | null = null
  private consecutiveErrors = 0
  private nextAllowedPollTime = 0
  private pollingAbortController: AbortController | null = null
  private lastPullCompletedAt = 0

  constructor(
    readonly _sync: IssyncSync,
    private readonly filePath: string,
    private readonly intervalMs: number,
    readonly _cwd: string,
    readonly _skipInitialPull: boolean = false,
    readonly _scope?: ConfigScope,
  ) {}

  /**
   * Start the watch session
   *
   * Initializes the session and returns immediately after setup completes.
   * The session will continue running until stop() is called.
   */
  async start(): Promise<void> {
    // Validate file exists before starting (fail-fast)
    if (!existsSync(this.filePath)) {
      throw new Error(`Local file does not exist: ${this.filePath}`)
    }

    // Start remote polling (performs initial pull synchronously)
    await this.startRemotePolling()

    // Start local file watching
    this.startFileWatching()

    // Return immediately after initialization - the session runs in the background
  }

  /**
   * Stop the watch session and clean up all resources
   *
   * This method is idempotent and can be safely called multiple times.
   * If the session is already shutting down, returns the existing shutdown promise.
   *
   * It stops remote polling, closes the file watcher, and resolves the shutdown promise.
   *
   * Used by the watch command's cleanup handler for graceful shutdown on SIGINT/SIGTERM,
   * and can be called programmatically when a session needs to be stopped.
   *
   * @returns Promise that resolves when the session has been fully stopped
   */
  async stop(): Promise<void> {
    if (this.shutdownPromise) {
      // Already shutting down, wait for it
      return this.shutdownPromise
    }

    this.shutdownPromise = this.doStop()
    return this.shutdownPromise
  }

  private async doStop(): Promise<void> {
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

  /**
   * Execute a single poll: check backoff, pull from remote, and handle errors
   */
  private async pollOnce(): Promise<void> {
    // Check backoff
    if (Date.now() < this.nextAllowedPollTime) return

    try {
      await this.withLock(async () => {
        const hasChanges = await pull({
          cwd: undefined,
          file: this._sync.local_file,
          scope: this._scope,
        })
        this.lastPullCompletedAt = Date.now() // Record pull completion time

        // Only log if there were actual changes
        if (hasChanges) {
          console.log(
            `[${new Date().toISOString()}] ✓ ${this.filePath}: Pulled changes from remote`,
          )
        }
      })
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `[${new Date().toISOString()}] ✗ ${this.filePath}: Pull error: ${error.message}`,
        )
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
    this.pollingAbortController = new AbortController()
    const signal = this.pollingAbortController.signal

    // Initial pull (synchronous, throws on error) - skip if already synced by safety check
    if (!this._skipInitialPull) {
      try {
        await pull({
          cwd: undefined,
          file: this._sync.local_file,
          scope: this._scope,
        })
        this.lastPullCompletedAt = Date.now() // Record initial pull completion time
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
    }

    // Run polling loop in background
    void this.runPollingLoop(signal)
  }

  private startFileWatching(): void {
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
      console.error(`File watcher error (${this.filePath}):`, error)
    })
  }

  private async handleFileChange(): Promise<void> {
    // Skip if this change is likely from a recent pull (prevents pull-push loop)
    const timeSinceLastPull = Date.now() - this.lastPullCompletedAt
    if (timeSinceLastPull < PULL_GRACE_PERIOD_MS) {
      const remainingMs = PULL_GRACE_PERIOD_MS - timeSinceLastPull
      console.log(
        `[${new Date().toISOString()}] ⚠️  ${this.filePath}: File change detected ${timeSinceLastPull}ms after pull (within grace period). ` +
          `This is likely from the pull operation and will be ignored. ` +
          `If you just edited the file, please save again in ${Math.ceil(remainingMs / 1000)}s.`,
      )
      return
    }

    console.log(`[${new Date().toISOString()}] ${this.filePath}: File changed, pushing...`)

    try {
      await this.withLock(async () => {
        await push({
          cwd: undefined,
          file: this._sync.local_file,
          scope: this._scope,
        })
        console.log(`[${new Date().toISOString()}] ✓ ${this.filePath}: Pushed changes to remote`)
      })
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        console.error(
          `[${new Date().toISOString()}] ⚠️  ${this.filePath}: Conflict detected: Remote was modified. Run "issync pull" to sync.`,
        )
      } else if (error instanceof Error) {
        console.error(
          `[${new Date().toISOString()}] ✗ ${this.filePath}: Push error: ${error.message}`,
        )
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
