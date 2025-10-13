import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { configExists, saveConfig } from '../lib/config.js'
import { FileAlreadyExistsError, FileNotFoundError, InvalidFilePathError } from '../lib/errors.js'
import { parseIssueUrl } from '../lib/github.js'
import type { IssyncConfig } from '../types/index.js'

interface InitOptions {
  file?: string
  cwd?: string
  template?: string
}

class AlreadyInitializedError extends Error {
  constructor() {
    super('Project is already initialized. .issync/state.yml already exists.')
    this.name = 'AlreadyInitializedError'
  }
}

function resolvePathWithinBase(basePath: string, targetPath: string, original: string): string {
  const resolved = path.resolve(basePath, targetPath)
  const relative = path.normalize(path.relative(basePath, resolved))

  if (path.isAbsolute(relative)) {
    throw new InvalidFilePathError(original, 'path traversal detected')
  }

  const segments = relative.split(path.sep)
  if (segments.some((segment) => segment === '..')) {
    throw new InvalidFilePathError(original, 'path traversal detected')
  }

  return resolved
}

export function init(issueUrl: string, options: InitOptions = {}): void {
  const { file = 'docs/plan.md', cwd, template } = options
  const workingDir = cwd ?? process.cwd()

  // Validate Issue URL by parsing it
  parseIssueUrl(issueUrl)

  // Check if already initialized
  if (configExists(cwd)) {
    throw new AlreadyInitializedError()
  }

  const basePath = path.resolve(workingDir)
  const targetPath = resolvePathWithinBase(basePath, file, file)
  const templatePath = template ? resolvePathWithinBase(basePath, template, template) : undefined

  if (templatePath) {
    if (!existsSync(templatePath)) {
      throw new FileNotFoundError(template)
    }

    const stats = statSync(templatePath)
    if (!stats.isFile()) {
      throw new InvalidFilePathError(template, 'template must be a file')
    }
  }

  const targetExists = existsSync(targetPath)

  if (templatePath && targetExists) {
    throw new FileAlreadyExistsError(file)
  }

  const parentDir = path.dirname(targetPath)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  if (!targetExists) {
    if (templatePath) {
      copyFileSync(templatePath, targetPath)
    } else {
      writeFileSync(targetPath, '', 'utf-8')
    }
  }

  // Create initial config
  const config: IssyncConfig = {
    issue_url: issueUrl,
    local_file: file,
  }

  // Save config (will create .issync directory)
  saveConfig(config, cwd)
}
