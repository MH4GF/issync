import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IssyncConfig } from '../types/index.js'
import { configExists, loadConfig, saveConfig } from './config'

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
      const config: IssyncConfig = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        local_file: 'docs/plan.md',
        poll_interval: 10,
        merge_strategy: 'simple',
      }
      saveConfig(config)

      // Act
      const result = configExists()

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('saveConfig', () => {
    test('creates .issync directory if it does not exist', () => {
      // Arrange
      const config: IssyncConfig = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        local_file: 'docs/plan.md',
        poll_interval: 10,
        merge_strategy: 'simple',
      }

      // Act
      saveConfig(config)

      // Assert: Directory should be created
      expect(existsSync('.issync')).toBe(true)
      expect(existsSync('.issync/state.yml')).toBe(true)
    })

    test('saves config to state file', () => {
      // Arrange
      const config: IssyncConfig = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123456789,
        local_file: 'docs/plan.md',
        last_synced_hash: 'abc123def',
        last_synced_at: '2025-10-12T10:30:00Z',
        poll_interval: 10,
        merge_strategy: 'section-based',
        watch_daemon_pid: 12345,
      }

      // Act
      saveConfig(config)

      // Assert: Config file should exist and be readable
      expect(configExists()).toBe(true)
    })

    test('overwrites existing config file', () => {
      // Arrange: Save initial config
      const initialConfig: IssyncConfig = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        local_file: 'docs/plan.md',
        poll_interval: 10,
        merge_strategy: 'simple',
      }
      saveConfig(initialConfig)

      // Act: Save updated config
      const updatedConfig: IssyncConfig = {
        issue_url: 'https://github.com/owner/repo/issues/2',
        comment_id: 987654321,
        local_file: 'docs/updated.md',
        last_synced_hash: 'xyz789abc',
        last_synced_at: '2025-10-12T11:00:00Z',
        poll_interval: 20,
        merge_strategy: 'section-based',
        watch_daemon_pid: 54321,
      }
      saveConfig(updatedConfig)

      // Assert: Should be able to load updated config
      const loadedConfig = loadConfig()
      expect(loadedConfig.issue_url).toBe('https://github.com/owner/repo/issues/2')
      expect(loadedConfig.comment_id).toBe(987654321)
      expect(loadedConfig.local_file).toBe('docs/updated.md')
      expect(loadedConfig.poll_interval).toBe(20)
    })
  })

  describe('loadConfig', () => {
    test('throws ConfigNotFoundError when state file does not exist', () => {
      // Act & Assert: Should throw custom error
      expect(() => loadConfig()).toThrow('.issync/state.yml not found')
    })

    test('loads config from state file', () => {
      // Arrange: Save a config first
      const config: IssyncConfig = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123456789,
        local_file: 'docs/plan.md',
        last_synced_hash: 'abc123def',
        last_synced_at: '2025-10-12T10:30:00Z',
        poll_interval: 10,
        merge_strategy: 'section-based',
        watch_daemon_pid: 12345,
      }
      saveConfig(config)

      // Act
      const loadedConfig = loadConfig()

      // Assert: All fields should be preserved
      expect(loadedConfig.issue_url).toBe('https://github.com/owner/repo/issues/1')
      expect(loadedConfig.comment_id).toBe(123456789)
      expect(loadedConfig.local_file).toBe('docs/plan.md')
      expect(loadedConfig.last_synced_hash).toBe('abc123def')
      expect(loadedConfig.last_synced_at).toBe('2025-10-12T10:30:00Z')
      expect(loadedConfig.poll_interval).toBe(10)
      expect(loadedConfig.merge_strategy).toBe('section-based')
      expect(loadedConfig.watch_daemon_pid).toBe(12345)
    })

    test('loads config with only required fields', () => {
      // Arrange: Minimal config with only required fields
      const config: IssyncConfig = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        local_file: 'docs/plan.md',
        poll_interval: 10,
        merge_strategy: 'simple',
      }
      saveConfig(config)

      // Act
      const loadedConfig = loadConfig()

      // Assert: Required fields should be present
      expect(loadedConfig.issue_url).toBe('https://github.com/owner/repo/issues/1')
      expect(loadedConfig.local_file).toBe('docs/plan.md')
      expect(loadedConfig.poll_interval).toBe(10)
      expect(loadedConfig.merge_strategy).toBe('simple')

      // Assert: Optional fields should be undefined
      expect(loadedConfig.comment_id).toBeUndefined()
      expect(loadedConfig.last_synced_hash).toBeUndefined()
      expect(loadedConfig.last_synced_at).toBeUndefined()
      expect(loadedConfig.watch_daemon_pid).toBeUndefined()
    })
  })
})
