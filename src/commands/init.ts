// Node.js built-in modules
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Project modules (alphabetical order)
import {
  checkDuplicateSync,
  configExists,
  loadConfig,
  normalizeLocalFilePath,
  saveConfig,
} from '../lib/config.js'
import {
  FileAlreadyExistsError,
  FileNotFoundError,
  GitHubAuthenticationError,
  InvalidFilePathError,
  SyncAlreadyExistsError,
} from '../lib/errors.js'
import { createGitHubClient, parseIssueUrl, removeMarker } from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import { resolvePathWithinBase } from '../lib/path.js'
import type {
  CommandOptions,
  CommentData,
  ConfigScope,
  GitHubIssueInfo,
  IssyncState,
  IssyncSync,
} from '../types/index.js'

const _DEFAULT_TEMPLATE_URL =
  'https://raw.githubusercontent.com/MH4GF/issync/refs/heads/main/docs/progress-document-template.md'

interface InitOptions extends CommandOptions {
  file?: string
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

function loadState(scope: ConfigScope | undefined, cwd: string | undefined): IssyncState {
  if (configExists(scope, cwd)) {
    return loadConfig(scope, cwd)
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

/**
 * Checks for existing issync comment on remote Issue
 * Returns null if not found or if network error occurs
 */
async function fetchRemoteCommentIfExists(
  issueInfo: GitHubIssueInfo,
  token?: string,
): Promise<CommentData | null> {
  console.log('Checking for existing comment...')
  const client = createGitHubClient(token)
  try {
    return await client.findIssyncComment(issueInfo.owner, issueInfo.repo, issueInfo.issue_number)
  } catch (error) {
    // Re-throw authentication errors (already wrapped in GitHubAuthenticationError)
    if (error instanceof GitHubAuthenticationError) {
      throw error
    }

    // For other errors (network, not found, etc.), fall back to template
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(`Failed to check for existing comment: ${errorMessage}`)
    console.warn('Continuing with template initialization...')
    return null
  }
}

/**
 * Pulls remote content to local file and updates sync metadata
 */
function pullRemoteContent(
  existingComment: CommentData,
  targetPath: string,
  sync: IssyncSync,
  file: string,
): void {
  const remoteContent = removeMarker(existingComment.body)
  const remoteHash = calculateHash(remoteContent)

  // Ensure parent directory exists
  const parentDir = path.dirname(targetPath)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  // Write remote content to local file
  writeFileSync(targetPath, remoteContent, 'utf-8')

  // Set sync metadata from remote
  sync.comment_id = existingComment.id
  sync.last_synced_hash = remoteHash
  sync.last_synced_at = new Date().toISOString()

  console.log(`✅ Pulled from remote comment (ID: ${existingComment.id}) → ${file}`)
}

/**
 * Initializes local file from template (URL, local file, or default template)
 */
async function initializeFromTemplate(
  targetPath: string,
  basePath: string,
  file: string,
  template?: string,
): Promise<void> {
  console.log('No existing comment found, initializing from template...')
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

  // Remove markers from template content before writing to local file
  const localContent = templateContent ? removeMarker(templateContent) : templateContent
  ensureTargetFile(targetPath, localContent, file)
}

export async function init(issueUrl: string, options: InitOptions = {}): Promise<string> {
  const { file, cwd, template, token, scope } = options
  const workingDir = cwd ?? process.cwd()

  // Validate Issue URL by parsing it
  const issueInfo = parseIssueUrl(issueUrl)

  // Use dynamic default based on issue number if no file is provided
  let targetFile = file ?? `.issync/docs/plan-${issueInfo.issue_number}.md`

  // Normalize file path based on scope (converts to absolute path for global scope)
  targetFile = normalizeLocalFilePath(targetFile, scope, workingDir)

  // Check for duplicate sync in global/local config
  checkDuplicateSync(issueUrl, scope)

  const basePath = path.resolve(workingDir)
  const targetPath = path.isAbsolute(targetFile)
    ? targetFile
    : resolvePathWithinBase(basePath, targetFile, targetFile)

  const state = loadState(scope, cwd)
  assertSyncAvailability(state, issueUrl, targetFile, basePath)

  // Create initial sync config
  const newSync: IssyncSync = {
    issue_url: issueUrl,
    local_file: targetFile,
  }

  // Check if remote issync comment already exists
  const existingComment = await fetchRemoteCommentIfExists(issueInfo, token)

  if (existingComment) {
    // Remote comment exists - pull content to local file
    pullRemoteContent(existingComment, targetPath, newSync, targetFile)
  } else {
    // No remote comment - initialize from template
    await initializeFromTemplate(targetPath, basePath, targetFile, template)
  }

  state.syncs.push(newSync)

  // Save config (will create .issync directory)
  saveConfig(state, scope, cwd)

  return targetFile
}
