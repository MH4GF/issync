import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { configExists, loadConfig, saveConfig } from '../lib/config.js'
import {
  FileAlreadyExistsError,
  FileNotFoundError,
  InvalidFilePathError,
  SyncAlreadyExistsError,
} from '../lib/errors.js'
import { parseIssueUrl } from '../lib/github.js'
import { resolvePathWithinBase } from '../lib/path.js'
import type { IssyncState, IssyncSync } from '../types/index.js'

const _DEFAULT_TEMPLATE_URL =
  'https://raw.githubusercontent.com/MH4GF/issync/refs/heads/main/docs/plan-template.md'

interface InitOptions {
  file?: string
  cwd?: string
  template?: string
}

function _isUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

async function _fetchTemplateFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch template from ${url}: ${response.status} ${response.statusText}`,
      )
    }
    return await response.text()
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch template from ${url}: ${error.message}`)
    }
    throw error
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
  templateContent: string | undefined,
  fileLabel: string,
): void {
  const targetExists = existsSync(targetPath)

  if (templateContent && targetExists) {
    throw new FileAlreadyExistsError(fileLabel)
  }

  const parentDir = path.dirname(targetPath)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  if (targetExists) return

  const content = templateContent ?? ''
  writeFileSync(targetPath, content, 'utf-8')
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

export async function init(issueUrl: string, options: InitOptions = {}): Promise<void> {
  const { file = 'docs/plan.md', cwd, template } = options
  const workingDir = cwd ?? process.cwd()

  // Validate Issue URL by parsing it
  parseIssueUrl(issueUrl)

  const basePath = path.resolve(workingDir)
  const targetPath = resolvePathWithinBase(basePath, file, file)

  // Determine template source and fetch content
  let templateContent: string | undefined

  if (template) {
    // User provided a template option
    if (_isUrl(template)) {
      // Fetch from URL
      templateContent = await _fetchTemplateFromUrl(template)
    } else {
      // Load from local file
      const templatePath = resolvePathWithinBase(basePath, template, template)
      validateTemplate(templatePath, template)
      templateContent = readFileSync(templatePath, 'utf-8')
    }
  } else if (!existsSync(targetPath)) {
    // No template option provided and target file doesn't exist, try default URL
    try {
      templateContent = await _fetchTemplateFromUrl(_DEFAULT_TEMPLATE_URL)
    } catch {
      // Fallback to empty file if default template fetch fails (e.g., offline)
      console.warn('Failed to fetch default template, creating empty file')
      templateContent = ''
    }
  }
  // else: No template and file exists, keep existing file (templateContent remains undefined)

  ensureTargetFile(targetPath, templateContent, file)

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
