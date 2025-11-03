import { spawn } from 'node:child_process'
import type { SyncSelector } from '../lib/config.js'
import { loadConfig, selectSync } from '../lib/config.js'
import { AmbiguousSyncError } from '../lib/errors.js'
import type { SelectorOptions } from '../types/index.js'

export type OpenOptions = SelectorOptions

/**
 * Get browser open command for current platform
 */
function getBrowserCommand(): string {
  switch (process.platform) {
    case 'darwin':
      return 'open'
    case 'win32':
      return 'start'
    default:
      return 'xdg-open'
  }
}

/**
 * Open URL in browser
 */
function openInBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = getBrowserCommand()
    const child = spawn(command, [url], {
      stdio: 'ignore',
      detached: true,
    })

    let settled = false

    child.on('error', (error) => {
      if (!settled) {
        settled = true
        reject(new Error(`Failed to open browser: ${error.message}`))
      }
    })

    child.on('exit', (code) => {
      if (!settled) {
        settled = true
        if (code === 0 || code === null) {
          resolve()
        } else {
          reject(new Error(`Browser command exited with code ${code}`))
        }
      }
    })

    child.unref()
  })
}

/**
 * Open the GitHub Issue for a sync configuration in the browser
 *
 * @throws {AmbiguousSyncError} When multiple syncs exist and no selector is provided
 * @throws {Error} When no sync configurations exist
 * @throws {SyncNotFoundError} When the selected sync is not found
 * @throws {Error} When browser command fails
 */
export async function open(options: OpenOptions = {}): Promise<void> {
  const { cwd, file, issue } = options
  const baseDir = cwd ?? process.cwd()

  // Load config
  const state = loadConfig(cwd)

  // If no selector provided and multiple syncs exist, throw error
  if (!file && !issue) {
    if (state.syncs.length > 1) {
      throw new AmbiguousSyncError()
    }
    if (state.syncs.length === 0) {
      throw new Error('No sync configurations found. Run `issync init` first.')
    }
    // Single sync: use it directly
    const sync = state.syncs[0]
    await openInBrowser(sync.issue_url)
    return
  }

  // Select sync by file or issue
  const selector: SyncSelector = {
    file,
    issueUrl: issue,
  }
  const { sync } = selectSync(state, selector, baseDir)
  await openInBrowser(sync.issue_url)
}
