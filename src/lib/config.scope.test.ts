import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IssyncState } from '../types/index.js'
import {
  checkDuplicateSync,
  configExists,
  loadConfig,
  normalizeLocalFilePath,
  resolveConfigPath,
  saveConfig,
} from './config.js'

describe('Global/Local Config Support', () => {
  let originalCwd: string
  let tempTestDir: string

  beforeEach(() => {
    // Save original cwd
    originalCwd = process.cwd()

    // Create temporary test directory
    tempTestDir = mkdtempSync(join(tmpdir(), 'issync-config-scope-test-'))

    // Change to test directory
    process.chdir(tempTestDir)
  })

  afterEach(() => {
    // Restore original cwd
    process.chdir(originalCwd)

    // Cleanup test directory
    rmSync(tempTestDir, { recursive: true, force: true })
  })

  describe('resolveConfigPath', () => {
    test('should return global path when scope is global', () => {
      const result = resolveConfigPath('global')
      expect(result.stateFile).toContain('.issync')
      expect(result.stateFile).toContain('state.yml')
      expect(result.stateFile).toContain(homedir())
    })

    test('should return local path when scope is local', () => {
      const result = resolveConfigPath('local')
      expect(result.stateFile).toContain('.issync')
      expect(result.stateFile).toContain('state.yml')
      expect(result.stateFile).toContain(process.cwd())
    })
  })

  describe('normalizeLocalFilePath', () => {
    test('should convert relative path to absolute for global scope', () => {
      const relativePath = 'docs/plan.md'
      const result = normalizeLocalFilePath(relativePath, 'global', tempTestDir)
      expect(result).toBe(join(tempTestDir, relativePath))
    })

    test('should keep absolute path as-is for global scope', () => {
      const absolutePath = '/tmp/docs/plan.md'
      const result = normalizeLocalFilePath(absolutePath, 'global', tempTestDir)
      expect(result).toBe(absolutePath)
    })

    test('should keep relative path as-is for local scope', () => {
      const relativePath = 'docs/plan.md'
      const result = normalizeLocalFilePath(relativePath, 'local', tempTestDir)
      expect(result).toBe(relativePath)
    })

    test('should keep relative path as-is for undefined scope', () => {
      const relativePath = 'docs/plan.md'
      const result = normalizeLocalFilePath(relativePath, undefined, tempTestDir)
      expect(result).toBe(relativePath)
    })
  })

  describe('loadConfig and saveConfig parameter validation', () => {
    test('loadConfig should throw when both scope and cwd are provided', () => {
      expect(() => loadConfig('global', tempTestDir)).toThrow(
        'Cannot specify both scope and cwd parameters',
      )
    })

    test('saveConfig should throw when both scope and cwd are provided', () => {
      const state: IssyncState = { syncs: [] }
      expect(() => saveConfig(state, 'global', tempTestDir)).toThrow(
        'Cannot specify both scope and cwd parameters',
      )
    })

    test('configExists should throw when both scope and cwd are provided', () => {
      expect(() => configExists('global', tempTestDir)).toThrow(
        'Cannot specify both scope and cwd parameters',
      )
    })
  })

  describe('checkDuplicateSync', () => {
    test('should throw when adding to global but already in local', () => {
      const issueUrl = 'https://github.com/owner/repo/issues/1'

      // Setup local config with the issue
      const localStateDir = join(tempTestDir, '.issync')
      mkdirSync(localStateDir, { recursive: true })
      const localState: IssyncState = {
        syncs: [{ issue_url: issueUrl, local_file: 'plan.md' }],
      }
      saveConfig(localState, 'local')

      // Try to add to global - should throw
      expect(() => checkDuplicateSync(issueUrl, 'global')).toThrow(
        'Issue already configured in local config',
      )
    })

    test('should throw when adding to local but already in global', () => {
      const issueUrl = 'https://github.com/owner/repo/issues/2'

      // Setup global config with the issue
      const globalStateDir = join(homedir(), '.issync')
      mkdirSync(globalStateDir, { recursive: true })
      const globalState: IssyncState = {
        syncs: [{ issue_url: issueUrl, local_file: '/tmp/plan.md' }],
      }
      saveConfig(globalState, 'global')

      try {
        // Try to add to local - should throw
        expect(() => checkDuplicateSync(issueUrl, 'local')).toThrow(
          'Issue already configured in global config',
        )
      } finally {
        // Cleanup global config
        rmSync(globalStateDir, { recursive: true, force: true })
      }
    })

    test('should not throw when issue does not exist in either config', () => {
      const issueUrl = 'https://github.com/owner/repo/issues/999'

      // No configs exist
      expect(() => checkDuplicateSync(issueUrl, 'global')).not.toThrow()
      expect(() => checkDuplicateSync(issueUrl, 'local')).not.toThrow()
    })
  })

  describe('Global/Local config isolation', () => {
    test('should save and load global config independently', () => {
      const globalState: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/1',
            local_file: '/tmp/global-plan.md',
          },
        ],
      }

      const globalStateDir = join(homedir(), '.issync')
      mkdirSync(globalStateDir, { recursive: true })

      try {
        saveConfig(globalState, 'global')
        const loaded = loadConfig('global')
        expect(loaded.syncs).toHaveLength(1)
        expect(loaded.syncs[0]?.issue_url).toBe('https://github.com/owner/repo/issues/1')
        expect(loaded.syncs[0]?.local_file).toBe('/tmp/global-plan.md')
      } finally {
        rmSync(globalStateDir, { recursive: true, force: true })
      }
    })

    test('should save and load local config independently', () => {
      const localState: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/2',
            local_file: 'local-plan.md',
          },
        ],
      }

      saveConfig(localState, 'local')
      const loaded = loadConfig('local')
      expect(loaded.syncs).toHaveLength(1)
      expect(loaded.syncs[0]?.issue_url).toBe('https://github.com/owner/repo/issues/2')
      expect(loaded.syncs[0]?.local_file).toBe('local-plan.md')
    })

    test('global and local configs should not interfere with each other', () => {
      const globalState: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/1',
            local_file: '/tmp/global-plan.md',
          },
        ],
      }

      const localState: IssyncState = {
        syncs: [
          {
            issue_url: 'https://github.com/owner/repo/issues/2',
            local_file: 'local-plan.md',
          },
        ],
      }

      const globalStateDir = join(homedir(), '.issync')
      mkdirSync(globalStateDir, { recursive: true })

      try {
        saveConfig(globalState, 'global')
        saveConfig(localState, 'local')

        const loadedGlobal = loadConfig('global')
        const loadedLocal = loadConfig('local')

        expect(loadedGlobal.syncs).toHaveLength(1)
        expect(loadedGlobal.syncs[0]?.local_file).toBe('/tmp/global-plan.md')

        expect(loadedLocal.syncs).toHaveLength(1)
        expect(loadedLocal.syncs[0]?.local_file).toBe('local-plan.md')
      } finally {
        rmSync(globalStateDir, { recursive: true, force: true })
      }
    })
  })
})
