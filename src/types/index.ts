export interface IssyncConfig {
  issue_url: string
  comment_id?: number
  local_file: string
  last_synced_hash?: string
  last_synced_at?: string
  poll_interval: number
  merge_strategy: 'section-based' | 'simple'
  watch_daemon_pid?: number
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
