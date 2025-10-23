import { loadConfig } from '../lib/config.js'
import { ConfigNotFoundError } from '../lib/errors.js'
import type { IssyncSync } from '../types/index.js'

export interface ListOptions {
  cwd?: string
}

function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) {
    return 'Never'
  }

  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  // Relative time for recent syncs
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  // Absolute time for older syncs
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calculateColumnWidths(syncs: IssyncSync[]): {
  urlWidth: number
  fileWidth: number
  timeWidth: number
} {
  const headers = {
    url: 'Issue URL',
    file: 'Local File',
    time: 'Last Synced',
  }

  let urlWidth = headers.url.length
  let fileWidth = headers.file.length
  let timeWidth = headers.time.length

  for (const sync of syncs) {
    urlWidth = Math.max(urlWidth, sync.issue_url.length)
    fileWidth = Math.max(fileWidth, sync.local_file.length)
    timeWidth = Math.max(timeWidth, formatTimestamp(sync.last_synced_at).length)
  }

  return { urlWidth, fileWidth, timeWidth }
}

export function formatSyncTable(syncs: IssyncSync[]): string {
  if (syncs.length === 0) {
    return 'No syncs configured.'
  }

  const { urlWidth, fileWidth, timeWidth } = calculateColumnWidths(syncs)
  const lines: string[] = []

  // Header
  lines.push(
    `${'Issue URL'.padEnd(urlWidth)}  ${'Local File'.padEnd(fileWidth)}  ${'Last Synced'.padEnd(timeWidth)}`,
  )
  lines.push(`${'-'.repeat(urlWidth)}  ${'-'.repeat(fileWidth)}  ${'-'.repeat(timeWidth)}`)

  // Rows
  for (const sync of syncs) {
    const url = sync.issue_url.padEnd(urlWidth)
    const file = sync.local_file.padEnd(fileWidth)
    const time = formatTimestamp(sync.last_synced_at).padEnd(timeWidth)
    lines.push(`${url}  ${file}  ${time}`)
  }

  return lines.join('\n')
}

export function list(options: ListOptions = {}): void {
  const { cwd } = options

  // Load state.yml
  let state: ReturnType<typeof loadConfig>
  try {
    state = loadConfig(undefined, cwd)
  } catch (error) {
    if (error instanceof ConfigNotFoundError) {
      throw new Error("No syncs configured. Run 'issync init <issue-url>' to get started.")
    }
    throw error
  }

  console.log(`\n${formatSyncTable(state.syncs)}\n`)
}
