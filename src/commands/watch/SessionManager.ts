import type { ConfigScope, IssyncSync } from '../../types/index.js'
import { formatError } from './errorReporter.js'
import { WatchSession } from './WatchSession.js'

/**
 * Result of stopping all sessions
 * @public This type is exported for use by consumers of SessionManager
 */
export type StopResult = {
  successCount: number
  failures: Array<{ issueUrl: string; error: unknown }>
}

/**
 * Manages multiple watch sessions
 *
 * Responsibilities:
 * - Track active watch sessions by issue URL
 * - Start new sessions with proper error handling
 * - Stop all sessions gracefully on shutdown
 * - Provide access to tracked URLs for state monitoring
 */
export class SessionManager {
  private sessions = new Map<string, WatchSession>()

  /**
   * Start a new watch session and add it to the manager
   *
   * @param sync - The sync configuration
   * @param resolvedPath - Validated absolute file path
   * @param intervalMs - Polling interval in milliseconds
   * @param cwd - Current working directory
   * @param skipInitialPull - Skip initial pull (used after safety check)
   * @param scope - Config scope (global/local) to pass to pull/push operations
   * @throws {Error} If session fails to start
   */
  async startSession(
    sync: IssyncSync,
    resolvedPath: string,
    intervalMs: number,
    cwd: string,
    skipInitialPull = true,
    scope?: ConfigScope,
  ): Promise<void> {
    const session = new WatchSession(sync, resolvedPath, intervalMs, cwd, skipInitialPull, scope)
    await session.start()
    this.sessions.set(sync.issue_url, session)
  }

  /**
   * Stop all active sessions gracefully
   *
   * Uses Promise.allSettled to ensure all sessions are stopped even if some fail.
   * Returns detailed information about which sessions failed to stop.
   *
   * @returns StopResult containing success count and failure details
   */
  async stopAll(): Promise<StopResult> {
    const sessionEntries = Array.from(this.sessions.entries())
    const results = await Promise.allSettled(sessionEntries.map(([, session]) => session.stop()))

    const failures = results
      .map((r, i) => ({ result: r, url: sessionEntries[i][0] }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, url }) => ({
        issueUrl: url,
        error: (result as PromiseRejectedResult).reason,
      }))

    if (failures.length > 0) {
      console.error(`\nWarning: ${failures.length} session(s) failed to stop cleanly`)
      for (const { issueUrl, error } of failures) {
        console.error(`  ${issueUrl}: ${formatError(error)}`)
      }
    }

    this.sessions.clear()
    return { successCount: results.length - failures.length, failures }
  }

  /**
   * Get the set of issue URLs currently being tracked
   *
   * Used by state file watcher to detect new syncs that need to be added.
   *
   * @returns Set of issue URLs
   */
  getTrackedUrls(): Set<string> {
    return new Set(this.sessions.keys())
  }

  /**
   * Get a session by issue URL
   *
   * @param issueUrl - The issue URL to look up
   * @returns The session if found, undefined otherwise
   */
  get(issueUrl: string): WatchSession | undefined {
    return this.sessions.get(issueUrl)
  }

  /**
   * Check if a session exists for the given issue URL
   *
   * @param issueUrl - The issue URL to check
   * @returns True if the session exists, false otherwise
   */
  has(issueUrl: string): boolean {
    return this.sessions.has(issueUrl)
  }

  /**
   * Get the number of active sessions
   *
   * @returns Number of active sessions
   */
  get size(): number {
    return this.sessions.size
  }
}
