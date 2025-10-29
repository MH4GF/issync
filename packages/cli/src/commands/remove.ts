import { existsSync, rmSync } from 'node:fs'
import { loadConfig, saveConfig, selectSync } from '../lib/config.js'
import type { CommandOptions } from '../types/index.js'

interface RemoveOptions extends CommandOptions {
  file?: string
  issue?: string
  deleteFile?: boolean
}

/**
 * Remove a sync configuration from state.yml
 * Optionally delete the local file with --delete-file flag
 */
export function remove(options: RemoveOptions = {}): void {
  const { file, issue, deleteFile = false, cwd } = options

  // Load current state
  const state = loadConfig(cwd)

  // Select sync to remove
  const { sync, index } = selectSync(state, { file, issueUrl: issue }, cwd)

  // Warn if watch daemon is running
  if (sync.watch_daemon_pid) {
    console.warn(
      `Warning: Watch daemon (PID: ${sync.watch_daemon_pid}) may be running for this sync.`,
    )
    console.warn('Consider stopping the watch process before removing the sync configuration.')
  }

  // Remove sync from state
  const newSyncs = [...state.syncs.slice(0, index), ...state.syncs.slice(index + 1)]
  const newState = { syncs: newSyncs }

  // Save updated state atomically
  saveConfig(newState, cwd)

  // Delete local file if requested
  if (deleteFile && existsSync(sync.local_file)) {
    rmSync(sync.local_file, { force: true })
    console.log(`Deleted local file: ${sync.local_file}`)
  }

  console.log(`✓ Removed sync configuration`)
  console.log(`  Issue: ${sync.issue_url}`)
  console.log(`  File:  ${sync.local_file}`)
}
