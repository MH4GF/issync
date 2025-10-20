import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import yaml from 'js-yaml'
import type { ConfigScope, IssyncState, IssyncSync } from '../types/index.js'
import { AmbiguousSyncError, ConfigNotFoundError, SyncNotFoundError } from './errors.js'

/**
 * Validates that scope and cwd parameters are not used together
 * @throws {Error} When both parameters are provided
 */
function validateScopeAndCwd(scope?: ConfigScope, cwd?: string): void {
  if (scope !== undefined && cwd !== undefined) {
    throw new Error(
      'Cannot specify both scope and cwd parameters. Use scope for new code, cwd for backward compatibility only.',
    )
  }
}

/**
 * Resolves the cwd parameter for config operations based on scope.
 *
 * Design rationale: When scope is explicitly specified (global/local),
 * the config path is predetermined and cwd should not influence it.
 * This prevents inconsistent config file lookups and ensures that
 * global/local scope always resolves to the correct config location.
 *
 * When scope is undefined, the function uses auto-detection behavior
 * (prefer global if exists, fallback to local), and cwd can be used
 * for backward compatibility with legacy code.
 *
 * @param scope - The config scope (global, local, or undefined)
 * @param cwd - The current working directory (optional)
 * @returns undefined if scope is specified (cwd ignored), otherwise cwd
 */
export function resolveCwdForScope(
  scope: ConfigScope | undefined,
  cwd: string | undefined,
): string | undefined {
  return scope === undefined ? cwd : undefined
}

/**
 * Resolves the config file path based on scope
 *
 * Auto-detection behavior (when scope is undefined):
 * 1. Check if global config exists → use global
 * 2. Otherwise → use local
 *
 * This means global config takes precedence when both exist.
 */
export function resolveConfigPath(scope?: ConfigScope): { stateDir: string; stateFile: string } {
  if (scope === 'global') {
    const stateDir = path.join(homedir(), '.issync')
    return {
      stateDir,
      stateFile: path.join(stateDir, 'state.yml'),
    }
  }
  if (scope === 'local') {
    const stateDir = path.join(process.cwd(), '.issync')
    return {
      stateDir,
      stateFile: path.join(stateDir, 'state.yml'),
    }
  }
  // デフォルト: グローバル優先
  const globalStateFile = path.join(homedir(), '.issync', 'state.yml')
  if (existsSync(globalStateFile)) {
    return {
      stateDir: path.join(homedir(), '.issync'),
      stateFile: globalStateFile,
    }
  }
  // フォールバック: ローカル設定
  const stateDir = path.join(process.cwd(), '.issync')
  return {
    stateDir,
    stateFile: path.join(stateDir, 'state.yml'),
  }
}

// Backward compatibility: getStatePath is deprecated, use resolveConfigPath instead
export function getStatePath(cwd = process.cwd()): { stateDir: string; stateFile: string } {
  return {
    stateDir: path.join(cwd, '.issync'),
    stateFile: path.join(cwd, '.issync', 'state.yml'),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeSync(raw: Record<string, unknown>): IssyncSync {
  if (raw.issue_url === undefined || raw.local_file === undefined) {
    throw new Error('Invalid sync configuration: issue_url and local_file are required')
  }

  return {
    issue_url: String(raw.issue_url),
    local_file: String(raw.local_file),
    comment_id: raw.comment_id !== undefined ? Number(raw.comment_id) : undefined,
    last_synced_hash: raw.last_synced_hash !== undefined ? String(raw.last_synced_hash) : undefined,
    last_synced_at: raw.last_synced_at !== undefined ? String(raw.last_synced_at) : undefined,
    poll_interval: raw.poll_interval !== undefined ? Number(raw.poll_interval) : undefined,
    merge_strategy:
      raw.merge_strategy === 'section-based' || raw.merge_strategy === 'simple'
        ? raw.merge_strategy
        : undefined,
    watch_daemon_pid: raw.watch_daemon_pid !== undefined ? Number(raw.watch_daemon_pid) : undefined,
  }
}

function parseState(raw: unknown): { state: IssyncState; migrated: boolean } {
  if (isRecord(raw) && Array.isArray(raw.syncs)) {
    const syncs = raw.syncs
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => normalizeSync(item))
    return { state: { syncs }, migrated: false }
  }

  if (isRecord(raw) && raw.issue_url && raw.local_file) {
    const sync = normalizeSync(raw)
    return { state: { syncs: [sync] }, migrated: true }
  }

  return { state: { syncs: [] }, migrated: false }
}

export function loadConfig(scope?: ConfigScope, cwd?: string): IssyncState {
  validateScopeAndCwd(scope, cwd)

  // For backward compatibility, if scope is not provided and cwd is provided, use getStatePath
  const { stateFile } = scope !== undefined ? resolveConfigPath(scope) : getStatePath(cwd)

  if (!existsSync(stateFile)) {
    throw new ConfigNotFoundError()
  }

  const content = readFileSync(stateFile, 'utf-8')
  const raw = yaml.load(content)
  const { state, migrated } = parseState(raw)

  if (migrated) {
    console.log('Migrated config from legacy format to new multi-sync format')
    saveConfig(state, scope, scope === undefined ? cwd : undefined)
  }

  return state
}

export function saveConfig(state: IssyncState, scope?: ConfigScope, cwd?: string): void {
  validateScopeAndCwd(scope, cwd)

  // For backward compatibility, if scope is not provided and cwd is provided, use getStatePath
  const { stateDir, stateFile } = scope !== undefined ? resolveConfigPath(scope) : getStatePath(cwd)

  // Create directory if it doesn't exist
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true })
  }

  const content = yaml.dump(state, { noRefs: true })
  writeFileSync(stateFile, content, 'utf-8')
}

export interface SyncSelector {
  file?: string
  issueUrl?: string
}

export function selectSync(
  state: IssyncState,
  selector: SyncSelector = {},
  cwd = process.cwd(),
): { sync: IssyncSync; index: number } {
  const { file, issueUrl } = selector

  if (state.syncs.length === 0) {
    throw new SyncNotFoundError()
  }

  const normalizedFile = file ? path.resolve(cwd, file) : undefined
  const normalizedIssue = issueUrl?.trim()

  const matches = state.syncs
    .map((sync, index) => ({
      sync,
      index,
      filePath: path.resolve(cwd, sync.local_file),
    }))
    .filter(({ sync, filePath }) => {
      if (normalizedFile && filePath !== normalizedFile) {
        return false
      }
      if (normalizedIssue && sync.issue_url !== normalizedIssue) {
        return false
      }
      return true
    })

  if (matches.length === 0) {
    if (normalizedFile) {
      throw new SyncNotFoundError(`No sync entry found for local file: ${file}`)
    }
    if (normalizedIssue) {
      throw new SyncNotFoundError(`No sync entry found for issue: ${normalizedIssue}`)
    }
    throw new SyncNotFoundError()
  }

  if (matches.length > 1) {
    throw new AmbiguousSyncError()
  }

  const match = matches[0]
  return { sync: match.sync, index: match.index }
}

export function configExists(scope?: ConfigScope, cwd?: string): boolean {
  validateScopeAndCwd(scope, cwd)

  // For backward compatibility, if scope is not provided and cwd is provided, use getStatePath
  const { stateFile } = scope !== undefined ? resolveConfigPath(scope) : getStatePath(cwd)
  return existsSync(stateFile)
}

/**
 * Normalizes and validates local file path based on config scope
 * @param localFile - The local file path to normalize
 * @param scope - Config scope (global or local)
 * @param cwd - Current working directory (default: process.cwd())
 * @returns Normalized file path
 *
 * Security Note:
 * - Global scope: Allows absolute paths anywhere in the filesystem (user responsibility)
 * - Local scope: Relative paths are recommended and will be resolved within project directory
 * - Path traversal attacks are mitigated by resolvePathWithinBase() for relative paths
 * - System directories (/etc, /sys, /proc, /dev) will trigger warnings for safety
 */
export function normalizeLocalFilePath(
  localFile: string,
  scope?: ConfigScope,
  cwd = process.cwd(),
): string {
  // For global scope, convert to absolute path and validate
  if (scope === 'global') {
    const absolutePath = path.isAbsolute(localFile) ? localFile : path.resolve(cwd, localFile)
    const normalized = path.normalize(absolutePath)

    // Warn about potentially dangerous system directories
    const dangerousDirectories = ['/etc/', '/sys/', '/proc/', '/dev/', '/boot/']
    for (const dir of dangerousDirectories) {
      if (normalized.startsWith(dir)) {
        console.warn(
          `⚠️  Warning: Using system directory "${dir}". This may cause system instability. Use at your own risk.`,
        )
      }
    }

    return normalized
  }

  // For local scope, warn if absolute path is used
  if (scope === 'local' && path.isAbsolute(localFile)) {
    console.warn(
      '⚠️  Local config typically uses relative paths. Consider using relative path instead.',
    )
  }

  return localFile
}

export function loadConfigIfExists(scope: ConfigScope): IssyncState | null {
  try {
    return loadConfig(scope)
  } catch (error) {
    if (error instanceof ConfigNotFoundError) {
      return null
    }
    throw error
  }
}

export function checkDuplicateSync(issueUrl: string, scope?: ConfigScope): void {
  // Only check for cross-scope duplicates when scope is explicitly specified
  // When scope is undefined (auto-detect), skip cross-scope check as user hasn't
  // made an explicit choice between global and local
  if (scope === undefined) {
    return
  }

  // Check opposite scope only (more efficient - only one file I/O operation)
  const oppositeScope = scope === 'global' ? 'local' : 'global'
  const oppositeConfig = loadConfigIfExists(oppositeScope)

  if (oppositeConfig?.syncs.some((s) => s.issue_url === issueUrl)) {
    throw new Error(`Issue already configured in ${oppositeScope} config: ${issueUrl}`)
  }
}
