class IssyncError extends Error {
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

export class InvalidFilePathError extends IssyncError {
  constructor(path: string, reason: string) {
    super(`Invalid file path "${path}": ${reason}`)
    this.name = 'InvalidFilePathError'
  }
}

export class FileNotFoundError extends IssyncError {
  constructor(path: string) {
    super(`File not found: ${path}`)
    this.name = 'FileNotFoundError'
  }
}

export class FileAlreadyExistsError extends IssyncError {
  constructor(path: string) {
    super(`File already exists: ${path}`)
    this.name = 'FileAlreadyExistsError'
  }
}

export class SyncNotFoundError extends IssyncError {
  constructor(message = 'No sync entry found. Run `issync init` to configure a sync target.') {
    super(message)
    this.name = 'SyncNotFoundError'
  }
}

export class AmbiguousSyncError extends IssyncError {
  constructor() {
    super('Multiple sync entries found. Specify --file or --issue to select a target.')
    this.name = 'AmbiguousSyncError'
  }
}

export class SyncAlreadyExistsError extends IssyncError {
  constructor(target: string, kind: 'issue' | 'file') {
    const label = kind === 'issue' ? 'issue' : 'local file'
    super(`Sync already exists for ${label}: ${target}`)
    this.name = 'SyncAlreadyExistsError'
  }
}
