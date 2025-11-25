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

export class DangerousPathError extends IssyncError {
  constructor(path: string, systemDir: string) {
    super(
      `Path "${path}" in system directory "${systemDir}" is not allowed for security reasons.\n` +
        'Please use a path in your home directory or project directory instead.',
    )
    this.name = 'DangerousPathError'
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

export class GitHubAuthenticationError extends IssyncError {
  constructor(message = 'GitHub authentication failed. Check GITHUB_TOKEN.') {
    super(message)
    this.name = 'GitHubAuthenticationError'
  }
}

export class LocalChangeError extends IssyncError {
  constructor(
    filePath: string,
    localHash: string,
    remoteHash: string,
    lastSyncedHash: string | undefined,
  ) {
    const lastSyncedHashShort = lastSyncedHash?.substring(0, 8) ?? 'unknown'
    const localHashShort = localHash.substring(0, 8)
    const remoteHashShort = remoteHash.substring(0, 8)

    super(
      'Local file has unsaved changes\n' +
        `  File: ${filePath}\n` +
        `  Local hash:       ${localHashShort}\n` +
        `  Remote hash:      ${remoteHashShort}\n` +
        `  Last synced hash: ${lastSyncedHashShort}\n\n` +
        'To overwrite local changes, use: issync pull --force\n' +
        'To keep local changes, commit them first or use: issync push',
    )
    this.name = 'LocalChangeError'
  }
}

export class GitHubProjectsNotConfiguredError extends IssyncError {
  constructor(missingVars: string[]) {
    super(
      `GitHub Projects environment variables not configured: ${missingVars.join(', ')}\n` +
        'Set the following environment variables:\n' +
        '  ISSYNC_GITHUB_PROJECTS_NUMBER - Project number\n' +
        '  ISSYNC_GITHUB_PROJECTS_OWNER - Project owner (user or organization)',
    )
    this.name = 'GitHubProjectsNotConfiguredError'
  }
}

export class ProjectNotFoundError extends IssyncError {
  constructor(owner: string, projectNumber: number) {
    super(`GitHub Project not found: ${owner}/projects/${projectNumber}`)
    this.name = 'ProjectNotFoundError'
  }
}

export class IssueNotInProjectError extends IssyncError {
  constructor(issueUrl: string) {
    super(`Issue is not tracked in the project: ${issueUrl}`)
    this.name = 'IssueNotInProjectError'
  }
}

export class FieldNotFoundError extends IssyncError {
  constructor(fieldName: string, projectId: string) {
    super(`Field "${fieldName}" not found in project ${projectId}`)
    this.name = 'FieldNotFoundError'
  }
}

export class OptionNotFoundError extends IssyncError {
  constructor(optionName: string, fieldName: string) {
    super(`Option "${optionName}" not found in field "${fieldName}"`)
    this.name = 'OptionNotFoundError'
  }
}
