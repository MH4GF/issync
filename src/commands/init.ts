import { configExists, saveConfig } from '../lib/config.js'
import { parseIssueUrl } from '../lib/github.js'
import type { IssyncConfig } from '../types/index.js'

export interface InitOptions {
  file?: string
  cwd?: string
}

export class AlreadyInitializedError extends Error {
  constructor() {
    super('Project is already initialized. .issync/state.yml already exists.')
    this.name = 'AlreadyInitializedError'
  }
}

export async function init(issueUrl: string, options: InitOptions = {}): Promise<void> {
  const { file = 'docs/plan.md', cwd } = options

  // Validate Issue URL by parsing it
  parseIssueUrl(issueUrl)

  // Check if already initialized
  if (configExists(cwd)) {
    throw new AlreadyInitializedError()
  }

  // Create initial config
  const config: IssyncConfig = {
    issue_url: issueUrl,
    local_file: file,
  }

  // Save config (will create .issync directory)
  saveConfig(config, cwd)
}
