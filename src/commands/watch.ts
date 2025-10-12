import { existsSync } from 'node:fs'
import chokidar, { type FSWatcher } from 'chokidar'
import { loadConfig } from '../lib/config.js'
import { ConfigNotFoundError } from '../lib/errors.js'
import { pull } from './pull.js'
import { OptimisticLockError, push } from './push.js'

export interface WatchOptions {
  interval?: number // polling interval in seconds
}

// Constants
const DEFAULT_POLL_INTERVAL_SECONDS = 10
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 60000
const FILE_STABILITY_THRESHOLD_MS = 500
const FILE_POLL_INTERVAL_MS = 100

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

  constructor(
    private readonly filePath: string,
    private readonly intervalMs: number,
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
        await pull()
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

    // Initial pull (synchronous, throws on error)
    try {
      await pull()
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
    console.log(`[${new Date().toISOString()}] File changed, pushing...`)

    try {
      await this.withLock(async () => {
        await push()
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
  const config = loadConfig()
  const intervalSeconds = options.interval ?? DEFAULT_POLL_INTERVAL_SECONDS
  const intervalMs = intervalSeconds * 1000

  const session = new WatchSession(config.local_file, intervalMs)
  await session.start()
}
