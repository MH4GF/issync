import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import yaml from 'js-yaml'
import type { IssyncState, IssyncSync } from '../types/index.js'
import {
  AmbiguousSyncError,
  ConfigNotFoundError,
  DangerousPathError,
  SyncNotFoundError,
} from './errors.js'

/**
 * Get home directory, respecting HOME environment variable for testing
 * Bun's homedir() ignores process.env.HOME, so we need this helper
 */
function getHomeDir(): string {
  const homeEnv = process.env.HOME?.trim()
  return homeEnv || homedir()
}

/**
 * Resolves the config file path
 * Always returns the global config path (~/.issync/state.yml)
 * For testing, use cwd parameter in loadConfig/saveConfig instead
 */
export function resolveConfigPath(): { stateDir: string; stateFile: string } {
  const stateDir = path.join(getHomeDir(), '.issync')
  return {
    stateDir,
    stateFile: path.join(stateDir, 'state.yml'),
  }
}

/**
 * Get state path for testing purposes
 * @internal
 */
function getStatePath(cwd: string): { stateDir: string; stateFile: string } {
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

export function loadConfig(cwd?: string): IssyncState {
  // For testing, if cwd is provided, use getStatePath
  const { stateFile } = cwd !== undefined ? getStatePath(cwd) : resolveConfigPath()

  if (!existsSync(stateFile)) {
    throw new ConfigNotFoundError()
  }

  const content = readFileSync(stateFile, 'utf-8')
  const raw = yaml.load(content)
  const { state, migrated } = parseState(raw)

  if (migrated) {
    console.log('Migrated config from legacy format to new multi-sync format')
    saveConfig(state, cwd)
  }

  return state
}

export function saveConfig(state: IssyncState, cwd?: string): void {
  // For testing, if cwd is provided, use getStatePath
  const { stateDir, stateFile } = cwd !== undefined ? getStatePath(cwd) : resolveConfigPath()

  // Normalize paths to absolute when saving to global config (cwd === undefined)
  // This prevents relative paths from causing issues when issync is run from different directories
  let normalizedState = state
  if (cwd === undefined) {
    const normalizedSyncs = state.syncs.map((sync) => {
      const localFile = sync.local_file

      // Check if path is relative
      if (!path.isAbsolute(localFile)) {
        const absolutePath = toAbsolutePath(localFile)
        console.warn(
          `[issync] Auto-converting relative path to absolute: ${localFile} → ${absolutePath}`,
        )
        return { ...sync, local_file: absolutePath }
      }

      return sync
    })

    normalizedState = { syncs: normalizedSyncs }
  }

  // Create directory if it doesn't exist
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true })
  }

  const content = yaml.dump(normalizedState, { noRefs: true })
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

export function configExists(cwd?: string): boolean {
  // For testing, if cwd is provided, use getStatePath
  const { stateFile } = cwd !== undefined ? getStatePath(cwd) : resolveConfigPath()
  return existsSync(stateFile)
}

/**
 * Converts a file path to absolute path
 * @param filePath - The file path to convert
 * @param cwd - Current working directory (default: process.cwd())
 * @returns Absolute file path
 * @throws {DangerousPathError} When path is in a system directory
 *
 * Security Note:
 * - Converts relative paths to absolute paths
 * - System directories (/etc, /sys, /proc, /dev, /boot) are blocked for safety
 */
export function toAbsolutePath(filePath: string, cwd = process.cwd()): string {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath)
  const normalized = path.normalize(absolutePath)

  // Block dangerous system directories
  const dangerousDirectories = ['/etc/', '/sys/', '/proc/', '/dev/', '/boot/']
  const dangerousDir = dangerousDirectories.find((dir) => normalized.startsWith(dir))

  if (dangerousDir) {
    throw new DangerousPathError(normalized, dangerousDir)
  }

  return normalized
}
