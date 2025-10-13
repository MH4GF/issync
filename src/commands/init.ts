import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { configExists, loadConfig, saveConfig } from '../lib/config.js'
import { FileAlreadyExistsError, FileNotFoundError, InvalidFilePathError } from '../lib/errors.js'
import { parseIssueUrl } from '../lib/github.js'
import { resolvePathWithinBase } from '../lib/path.js'
import type { IssyncState, IssyncSync } from '../types/index.js'

interface InitOptions {
  file?: string
  cwd?: string
  template?: string
}

class SyncAlreadyExistsError extends Error {
  constructor(target: string, kind: 'issue' | 'file') {
    const label = kind === 'issue' ? 'issue' : 'local file'
    super(`Sync already exists for ${label}: ${target}`)
    this.name = 'SyncAlreadyExistsError'
  }
}

function validateTemplate(templatePath: string | undefined, templateOption?: string): void {
  if (!templatePath) return

  if (!existsSync(templatePath)) {
    throw new FileNotFoundError(templateOption ?? templatePath)
  }

  const stats = statSync(templatePath)
  if (!stats.isFile()) {
    throw new InvalidFilePathError(templateOption ?? templatePath, 'template must be a file')
  }
}

function ensureTargetFile(
  targetPath: string,
  templatePath: string | undefined,
  fileLabel: string,
): void {
  const targetExists = existsSync(targetPath)

  if (templatePath && targetExists) {
    throw new FileAlreadyExistsError(fileLabel)
  }

  const parentDir = path.dirname(targetPath)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  if (targetExists) return

  if (templatePath) {
    copyFileSync(templatePath, targetPath)
    return
  }

  writeFileSync(targetPath, '', 'utf-8')
}

function loadState(cwd?: string): IssyncState {
  if (configExists(cwd)) {
    return loadConfig(cwd)
  }
  return { syncs: [] }
}

function assertSyncAvailability(
  state: IssyncState,
  issueUrl: string,
  file: string,
  basePath: string,
): void {
  if (state.syncs.some((sync) => sync.issue_url === issueUrl)) {
    throw new SyncAlreadyExistsError(issueUrl, 'issue')
  }

  const targetAbsolute = path.resolve(basePath, file)
  const duplicateFile = state.syncs.some((sync) => {
    const existingPath = path.resolve(basePath, sync.local_file)
    return existingPath === targetAbsolute
  })

  if (duplicateFile) {
    throw new SyncAlreadyExistsError(file, 'file')
  }
}

export function init(issueUrl: string, options: InitOptions = {}): void {
  const { file = 'docs/plan.md', cwd, template } = options
  const workingDir = cwd ?? process.cwd()

  // Validate Issue URL by parsing it
  parseIssueUrl(issueUrl)

  const basePath = path.resolve(workingDir)
  const targetPath = resolvePathWithinBase(basePath, file, file)
  const templatePath = template ? resolvePathWithinBase(basePath, template, template) : undefined

  validateTemplate(templatePath, template)
  ensureTargetFile(targetPath, templatePath, file)

  const state = loadState(cwd)
  assertSyncAvailability(state, issueUrl, file, basePath)

  // Create initial config
  const newSync: IssyncSync = {
    issue_url: issueUrl,
    local_file: file,
  }

  state.syncs.push(newSync)

  // Save config (will create .issync directory)
  saveConfig(state, cwd)
}
