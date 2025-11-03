import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { saveConfig } from '../lib/config.js'
import { AmbiguousSyncError } from '../lib/errors.js'
import type { IssyncState } from '../types/index.js'
import { open } from './open.js'

// Mock child_process.spawn
const mockSpawn = mock()

describe('open command', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-open-'))
    mockSpawn.mockReset()

    // Ensure mock is properly set up for each test
    await mock.module('node:child_process', () => ({
      spawn: mockSpawn,
    }))
  })

  afterEach(async () => {
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('opens single sync configuration without options', async () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_at: new Date().toISOString(),
        },
      ],
    }
    saveConfig(state, tempDir)

    // Mock successful spawn
    const mockChild = {
      on: mock((event: string, callback: (code: number | null) => void) => {
        if (event === 'exit') {
          // Simulate immediate success
          setTimeout(() => callback(0), 0)
        }
      }),
      unref: mock(),
    }
    mockSpawn.mockReturnValue(mockChild)

    // Act
    await open({ cwd: tempDir })

    // Assert
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      ['https://github.com/owner/repo/issues/123'],
      expect.objectContaining({
        stdio: 'ignore',
        detached: true,
      }),
    )
  })

  test('throws AmbiguousSyncError when multiple syncs exist without options', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_at: new Date().toISOString(),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/456',
          local_file: '.issync/docs/plan-456.md',
          comment_id: 222,
          last_synced_at: new Date().toISOString(),
        },
      ],
    }
    saveConfig(state, tempDir)

    // Act & Assert
    expect(open({ cwd: tempDir })).rejects.toThrow(AmbiguousSyncError)
  })

  test('throws error when no sync configurations exist', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [],
    }
    saveConfig(state, tempDir)

    // Act & Assert
    expect(open({ cwd: tempDir })).rejects.toThrow(
      'No sync configurations found. Run `issync init` first.',
    )
  })

  test('opens sync by file option', async () => {
    // Arrange
    const localFile = path.join(tempDir, '.issync/docs/plan-123.md')
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: localFile,
          comment_id: 111,
          last_synced_at: new Date().toISOString(),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/456',
          local_file: path.join(tempDir, '.issync/docs/plan-456.md'),
          comment_id: 222,
          last_synced_at: new Date().toISOString(),
        },
      ],
    }
    saveConfig(state, tempDir)

    // Mock successful spawn
    const mockChild = {
      on: mock((event: string, callback: (code: number | null) => void) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 0)
        }
      }),
      unref: mock(),
    }
    mockSpawn.mockReturnValue(mockChild)

    // Act
    await open({ cwd: tempDir, file: localFile })

    // Assert
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      ['https://github.com/owner/repo/issues/123'],
      expect.objectContaining({
        stdio: 'ignore',
        detached: true,
      }),
    )
  })

  test('opens sync by issue option', async () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_at: new Date().toISOString(),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/456',
          local_file: '.issync/docs/plan-456.md',
          comment_id: 222,
          last_synced_at: new Date().toISOString(),
        },
      ],
    }
    saveConfig(state, tempDir)

    // Mock successful spawn
    const mockChild = {
      on: mock((event: string, callback: (code: number | null) => void) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 0)
        }
      }),
      unref: mock(),
    }
    mockSpawn.mockReturnValue(mockChild)

    // Act
    await open({ cwd: tempDir, issue: 'https://github.com/owner/repo/issues/456' })

    // Assert
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      ['https://github.com/owner/repo/issues/456'],
      expect.objectContaining({
        stdio: 'ignore',
        detached: true,
      }),
    )
  })

  test('throws error when browser command fails', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_at: new Date().toISOString(),
        },
      ],
    }
    saveConfig(state, tempDir)

    // Mock spawn error
    const mockChild = {
      on: mock((event: string, callback: (error?: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Command not found')), 0)
        }
      }),
      unref: mock(),
    }
    mockSpawn.mockReturnValue(mockChild)

    // Act & Assert
    expect(open({ cwd: tempDir })).rejects.toThrow('Failed to open browser: Command not found')
  })

  test('throws error when browser command exits with non-zero code', () => {
    // Arrange
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/123',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 111,
          last_synced_at: new Date().toISOString(),
        },
      ],
    }
    saveConfig(state, tempDir)

    // Mock spawn exit with error code
    const mockChild = {
      on: mock((event: string, callback: (code: number | null) => void) => {
        if (event === 'exit') {
          setTimeout(() => callback(1), 0)
        }
      }),
      unref: mock(),
    }
    mockSpawn.mockReturnValue(mockChild)

    // Act & Assert
    expect(open({ cwd: tempDir })).rejects.toThrow('Browser command exited with code 1')
  })
})
