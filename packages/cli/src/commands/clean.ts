import { existsSync } from 'node:fs'
import { loadConfig, saveConfig } from '../lib/config.js'
import { confirmAction } from '../lib/prompt.js'
import type { CommandOptions, IssyncSync } from '../types/index.js'

interface CleanOptions extends CommandOptions {
  dryRun?: boolean
  force?: boolean
}

/**
 * Clean stale sync configurations (where local file does not exist)
 */
export async function clean(options: CleanOptions = {}): Promise<void> {
  const { dryRun = false, force = false, cwd } = options

  // Load current state
  const state = loadConfig(cwd)

  // Find stale syncs (local file does not exist)
  const staleSyncs: Array<{ sync: IssyncSync; index: number }> = []

  for (const [index, sync] of state.syncs.entries()) {
    if (!existsSync(sync.local_file)) {
      staleSyncs.push({ sync, index })
    }
  }

  // Handle no stale syncs case
  if (staleSyncs.length === 0) {
    console.log('✓ No stale sync configurations found. All syncs are valid.')
    return
  }

  // Display stale syncs in table format (similar to list command)
  console.log(`Found ${staleSyncs.length} stale sync configuration(s):\n`)
  console.log('Issue URL'.padEnd(42), 'Local File')
  console.log('-'.repeat(42), '-'.repeat(80))

  for (const { sync } of staleSyncs) {
    const issueUrl = sync.issue_url.padEnd(42)
    console.log(issueUrl, sync.local_file)
  }

  console.log('')

  // Dry-run mode: just display, don't delete
  if (dryRun) {
    console.log('Dry-run mode: No changes made.')
    return
  }

  // Interactive confirmation (unless force mode)
  if (!force) {
    const confirmed = await confirmAction({
      message: `About to remove ${staleSyncs.length} sync configuration(s) from state.yml.`,
      question: 'Continue? [y/N] ',
    })

    if (!confirmed) {
      console.log('Cancelled.')
      return
    }
  }

  // Remove stale syncs from state
  const indicesToRemove = new Set(staleSyncs.map((s) => s.index))
  const newSyncs = state.syncs.filter((_, index) => !indicesToRemove.has(index))
  const newState = { syncs: newSyncs }

  // Save updated state
  saveConfig(newState, cwd)

  console.log(`✓ Removed ${staleSyncs.length} stale sync configuration(s)`)
}
