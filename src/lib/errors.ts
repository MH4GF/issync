export class IssyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IssyncError'
  }
}

export class ConfigNotFoundError extends IssyncError {
  constructor() {
    super('.issync/state.yml not found. Run `issync init` first.')
    this.name = 'ConfigNotFoundError'
  }
}

export class InvalidIssueUrlError extends IssyncError {
  constructor(url: string) {
    super(`Invalid GitHub Issue URL: ${url}`)
    this.name = 'InvalidIssueUrlError'
  }
}

export class GitHubTokenMissingError extends IssyncError {
  constructor() {
    super(
      'GitHub token required. Set GITHUB_TOKEN environment variable or pass token to constructor.',
    )
    this.name = 'GitHubTokenMissingError'
  }
}
