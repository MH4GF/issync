import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IssyncState, IssyncSync } from '../types/index.js'
import { configExists, loadConfig, saveConfig, selectSync } from './config'
import { AmbiguousSyncError, SyncNotFoundError } from './errors'

describe('config', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(() => {
    // Save original working directory
    originalCwd = process.cwd()

    // Create temporary test directory
    testDir = mkdtempSync(join(tmpdir(), 'issync-test-'))
    process.chdir(testDir)
  })

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd)

    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true })
  })

  describe('configExists', () => {
    test('returns false when state file does not exist', () => {
      // Act
      const result = configExists()

      // Assert: No config file in fresh test directory
      expect(result).toBe(false)
    })

    test('returns true when state file exists', () => {
      // Arrange: Create a minimal config
      const state: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/1',
            local_file: '.issync/docs/plan-1.md',
            poll_interval: 10,
            merge_strategy: 'simple',
          },
        ],
      }
      saveConfig(state)

      // Act
      const result = configExists()

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('saveConfig', () => {
    test('creates .issync directory if it does not exist', () => {
      // Arrange
      const state: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/1',
            local_file: '.issync/docs/plan-1.md',
            poll_interval: 10,
            merge_strategy: 'simple',
          },
        ],
      }

      // Act
      saveConfig(state)

      // Assert: Directory should be created
      expect(existsSync('.issync')).toBe(true)
      expect(existsSync('.issync/state.yml')).toBe(true)
    })

    test('saves config to state file', () => {
      // Arrange
      const sync: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123456789,
        local_file: '.issync/docs/plan-123.md',
        last_synced_hash: 'abc123def',
        last_synced_at: '2025-10-12T10:30:00Z',
        poll_interval: 10,
        merge_strategy: 'section-based',
        watch_daemon_pid: 12345,
      }

      // Act
      saveConfig({ syncs: [sync] })

      // Assert: Config file should exist and be readable
      expect(configExists()).toBe(true)
    })

    test('overwrites existing config file', () => {
      // Arrange: Save initial config
      const initialState: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/1',
            local_file: '.issync/docs/plan-123.md',
            poll_interval: 10,
            merge_strategy: 'simple',
          },
        ],
      }
      saveConfig(initialState)

      // Act: Save updated config
      const updatedState: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/2',
            comment_id: 987654321,
            local_file: 'docs/updated.md',
            last_synced_hash: 'xyz789abc',
            last_synced_at: '2025-10-12T11:00:00Z',
            poll_interval: 20,
            merge_strategy: 'section-based',
            watch_daemon_pid: 54321,
          },
        ],
      }
      saveConfig(updatedState)

      // Assert: Should be able to load updated config
      const loadedState = loadConfig()
      expect(loadedState.syncs).toHaveLength(1)
      expect(loadedState.syncs[0]?.issue_url).toBe('https://github.com/owner/repo/issues/2')
      expect(loadedState.syncs[0]?.comment_id).toBe(987654321)
      expect(loadedState.syncs[0]?.local_file).toBe('docs/updated.md')
      expect(loadedState.syncs[0]?.poll_interval).toBe(20)
    })
  })

  describe('loadConfig', () => {
    test('throws ConfigNotFoundError when state file does not exist', () => {
      // Act & Assert: Should throw custom error
      expect(() => loadConfig()).toThrow('.issync/state.yml not found')
    })

    test('loads config from state file', () => {
      // Arrange: Save a config first
      const sync: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123456789,
        local_file: '.issync/docs/plan-123.md',
        last_synced_hash: 'abc123def',
        last_synced_at: '2025-10-12T10:30:00Z',
        poll_interval: 10,
        merge_strategy: 'section-based',
        watch_daemon_pid: 12345,
      }
      saveConfig({ syncs: [sync] })

      // Act
      const loadedState = loadConfig()

      // Assert: All fields should be preserved
      expect(loadedState.syncs).toHaveLength(1)
      const loadedSync = loadedState.syncs[0]
      expect(loadedSync?.issue_url).toBe('https://github.com/owner/repo/issues/1')
      expect(loadedSync?.comment_id).toBe(123456789)
      expect(loadedSync?.local_file).toBe('.issync/docs/plan-123.md')
      expect(loadedSync?.last_synced_hash).toBe('abc123def')
      expect(loadedSync?.last_synced_at).toBe('2025-10-12T10:30:00Z')
      expect(loadedSync?.poll_interval).toBe(10)
      expect(loadedSync?.merge_strategy).toBe('section-based')
      expect(loadedSync?.watch_daemon_pid).toBe(12345)
    })

    test('loads config with only required fields', () => {
      // Arrange: Minimal config with only required fields
      const sync: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        local_file: '.issync/docs/plan-123.md',
        poll_interval: 10,
        merge_strategy: 'simple',
      }
      saveConfig({ syncs: [sync] })

      // Act
      const loadedState = loadConfig()

      // Assert: Required fields should be present
      expect(loadedState.syncs).toHaveLength(1)
      const loadedSync = loadedState.syncs[0]
      expect(loadedSync?.issue_url).toBe('https://github.com/owner/repo/issues/1')
      expect(loadedSync?.local_file).toBe('.issync/docs/plan-123.md')
      expect(loadedSync?.poll_interval).toBe(10)
      expect(loadedSync?.merge_strategy).toBe('simple')

      // Assert: Optional fields should be undefined
      expect(loadedSync?.comment_id).toBeUndefined()
      expect(loadedSync?.last_synced_hash).toBeUndefined()
      expect(loadedSync?.last_synced_at).toBeUndefined()
      expect(loadedSync?.watch_daemon_pid).toBeUndefined()
    })

    test('migrates legacy single-config format to sync array', () => {
      const legacyContent = [
        'issue_url: https://github.com/owner/repo/issues/1',
        'local_file: .issync/docs/plan-123.md',
        'comment_id: 123',
      ].join('\n')

      mkdirSync('.issync', { recursive: true })
      writeFileSync('.issync/state.yml', legacyContent, 'utf-8')

      const loadedState = loadConfig()

      expect(loadedState.syncs).toHaveLength(1)
      const sync = loadedState.syncs[0]
      expect(sync?.issue_url).toBe('https://github.com/owner/repo/issues/1')
      expect(sync?.local_file).toBe('.issync/docs/plan-123.md')
      expect(sync?.comment_id).toBe(123)

      const migratedContent = readFileSync('.issync/state.yml', 'utf-8')
      expect(migratedContent).toContain('syncs:')
    })
  })

  describe('selectSync', () => {
    test('returns sole sync when no selector provided', () => {
      const state: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/1',
            local_file: '.issync/docs/plan-123.md',
          },
        ],
      }

      const { sync } = selectSync(state, {}, testDir)
      expect(sync.issue_url).toBe('https://github.com/owner/repo/issues/1')
    })

    test('throws AmbiguousSyncError when multiple syncs without selector', () => {
      const state: IssyncState = {
        syncs: [
          { issue_url: 'https://github.com/owner/repo/issues/1', local_file: 'docs/one.md' },
          { issue_url: 'https://github.com/owner/repo/issues/2', local_file: 'docs/two.md' },
        ],
      }

      expect(() => selectSync(state, {}, testDir)).toThrow(AmbiguousSyncError)
    })

    test('selects sync by local file path', () => {
      const state: IssyncState = {
        syncs: [
          { issue_url: 'https://github.com/owner/repo/issues/1', local_file: 'docs/one.md' },
          { issue_url: 'https://github.com/owner/repo/issues/2', local_file: 'docs/two.md' },
        ],
      }

      const { sync } = selectSync(state, { file: './docs/two.md' }, testDir)
      expect(sync.issue_url).toBe('https://github.com/owner/repo/issues/2')
    })

    test('selects sync by issue URL', () => {
      const state: IssyncState = {
        syncs: [
          { issue_url: 'https://github.com/owner/repo/issues/1', local_file: 'docs/one.md' },
          { issue_url: 'https://github.com/owner/repo/issues/2', local_file: 'docs/two.md' },
        ],
      }

      const { sync } = selectSync(
        state,
        { issueUrl: 'https://github.com/owner/repo/issues/1' },
        testDir,
      )
      expect(sync.local_file).toBe('docs/one.md')
    })

    test('throws SyncNotFoundError when selector does not match', () => {
      const state: IssyncState = {
        syncs: [{ issue_url: 'https://github.com/owner/repo/issues/1', local_file: 'docs/one.md' }],
      }

      expect(() => selectSync(state, { file: 'docs/unknown.md' }, testDir)).toThrow(
        SyncNotFoundError,
      )
    })
  })
})
