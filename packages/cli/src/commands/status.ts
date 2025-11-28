import type { SyncSelector } from '../lib/config.js'
import { loadConfig, selectSync } from '../lib/config.js'
import type { IssyncSync } from '../types/index.js'

interface StatusOptions {
  cwd?: string
  json?: boolean
}

function formatStatusOutput(sync: IssyncSync): string {
  const lines: string[] = []

  lines.push('Sync Configuration:')
  lines.push(`  Issue URL:       ${sync.issue_url}`)
  lines.push(`  Local File:      ${sync.local_file}`)
  lines.push(`  Comment ID:      ${sync.comment_id ?? 'Not created yet'}`)
  lines.push(`  Last Synced:     ${sync.last_synced_at ?? 'Never'}`)
  lines.push(
    `  Last Hash:       ${sync.last_synced_hash ? `${sync.last_synced_hash.slice(0, 12)}...` : 'None'}`,
  )
  if (sync.poll_interval !== undefined) {
    lines.push(`  Poll Interval:   ${sync.poll_interval}s`)
  }
  if (sync.watch_daemon_pid !== undefined) {
    lines.push(`  Watch Daemon:    Running (PID: ${sync.watch_daemon_pid})`)
  }

  return lines.join('\n')
}

export function status(issueUrl: string, options: StatusOptions = {}): void {
  const { cwd, json } = options
  const baseDir = cwd ?? process.cwd()

  // Load config
  const state = loadConfig(cwd)

  // Select sync by issue URL
  const selector: SyncSelector = {
    issueUrl,
  }
  const { sync } = selectSync(state, selector, baseDir)

  // Output
  if (json) {
    console.log(JSON.stringify(sync, null, 2))
  } else {
    console.log(`\n${formatStatusOutput(sync)}\n`)
  }
}
