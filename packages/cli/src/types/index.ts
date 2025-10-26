/**
 * Base options common to all commands
 */
export interface CommandOptions {
  cwd?: string
  token?: string
}

/**
 * Options for commands that need to select a specific sync target
 */
export interface SelectorOptions extends CommandOptions {
  file?: string
  issue?: string
}

export interface IssyncSync {
  issue_url: string
  comment_id?: number
  local_file: string
  last_synced_hash?: string
  last_synced_at?: string
  // Phase 2: watch mode configuration
  poll_interval?: number
  merge_strategy?: 'section-based' | 'simple'
  watch_daemon_pid?: number
}

export interface IssyncState {
  syncs: IssyncSync[]
}

export interface GitHubIssueInfo {
  owner: string
  repo: string
  issue_number: number
}

export interface CommentData {
  id: number
  body: string
  updated_at: string
}
