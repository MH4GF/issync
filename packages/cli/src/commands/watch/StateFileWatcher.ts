import chokidar, { type FSWatcher } from 'chokidar'

const FILE_STABILITY_THRESHOLD_MS = 500
const FILE_POLL_INTERVAL_MS = 100
const MAX_STATE_WATCHER_ERRORS = 5

/**
 * Watches state.yml for changes and triggers a callback
 *
 * This class monitors the state.yml file for changes and invokes a callback
 * when changes are detected. It includes error handling with automatic shutdown
 * after too many consecutive errors.
 *
 * Design decisions:
 * - Uses chokidar's awaitWriteFinish to avoid triggering on partial writes
 * - Limits error count to prevent infinite error loops
 * - Provides clean shutdown mechanism via stop()
 */
export class StateFileWatcher {
  private watcher: FSWatcher | null = null
  private errorCount = 0

  constructor(
    private readonly stateFile: string,
    private readonly onStateChange: () => Promise<void>,
  ) {}

  /**
   * Start watching the state file
   *
   * Sets up chokidar watcher with proper options and event handlers.
   */
  start(): void {
    this.watcher = chokidar.watch(this.stateFile, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: FILE_STABILITY_THRESHOLD_MS,
        pollInterval: FILE_POLL_INTERVAL_MS,
      },
    })

    this.watcher.on('change', () => void this.handleChange())
    this.watcher.on('error', this.handleError.bind(this))
  }

  /**
   * Handle state file change event
   *
   * Invokes the callback provided in the constructor.
   * Errors are logged but do not stop the watcher (unless too many occur).
   */
  private async handleChange(): Promise<void> {
    try {
      await this.onStateChange()
    } catch (error) {
      console.error('Error in state change handler:', error)
    }
  }

  /**
   * Handle watcher errors
   *
   * Increments error count and stops the watcher if too many errors occur.
   */
  private handleError(error: unknown): void {
    this.errorCount++
    console.error(`State watcher error (${this.errorCount}/${MAX_STATE_WATCHER_ERRORS}):`, error)

    if (this.errorCount >= MAX_STATE_WATCHER_ERRORS) {
      console.error('Too many state watcher errors, stopping dynamic file addition')
      void this.stop()
    }
  }

  /**
   * Stop the watcher and clean up resources
   *
   * This method is idempotent and can be safely called multiple times.
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }
}
