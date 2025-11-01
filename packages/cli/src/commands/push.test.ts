import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import { loadConfig, saveConfig } from '../lib/config.js'
import * as githubModule from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import { confirmAction } from '../lib/prompt.js'
import { expectNthCallContent } from '../lib/test-helpers.js'
import type { IssyncState } from '../types/index.js'
import { push } from './push.js'

type GitHubClientInstance = ReturnType<typeof githubModule.createGitHubClient>

describe('push command - multi-sync support', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-push-'))
  })

  afterEach(async () => {
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('pushes selected sync by file path', async () => {
    const previousBody = '# Remote Content'
    const localBody = '# Updated Content'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/one.md',
          comment_id: 111,
          last_synced_hash: calculateHash(previousBody),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/two.md',
          comment_id: 222,
          last_synced_hash: calculateHash(previousBody),
        },
      ],
    }
    saveConfig(state, tempDir)

    await mkdir(path.join(tempDir, 'docs'), { recursive: true })
    await writeFile(path.join(tempDir, 'docs/two.md'), localBody, 'utf-8')

    const updateComment = mock<GitHubClientInstance['updateComment']>(() =>
      Promise.resolve({
        id: 222,
        body: '',
        updated_at: '2025-01-01T00:00:00Z',
      }),
    )
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: () =>
        Promise.resolve({
          id: 222,
          body: githubModule.addMarker(previousBody),
          updated_at: '2025-01-01T00:00:00Z',
        }),
      updateComment: (...args: Parameters<GitHubClientInstance['updateComment']>) =>
        updateComment(...args),
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await push({ cwd: tempDir, file: 'docs/two.md' })

    expect(updateComment).toHaveBeenCalledTimes(1)
    const firstCall = updateComment.mock.calls[0]
    expect(firstCall).toBeDefined()
    if (!firstCall) {
      throw new Error('Expected updateComment to be called at least once')
    }
    const [owner, repo, commentId, content] = firstCall
    expect(`${owner}/${repo}`).toBe('owner/repo')
    expect(commentId).toBe(222)
    expect(content).toBe(githubModule.addMarker(localBody))

    const updatedState = loadConfig(tempDir)
    const sync = updatedState.syncs.find((entry) => entry.local_file === 'docs/two.md')
    expect(sync?.last_synced_hash).toBe(calculateHash(localBody))
    expect(sync?.last_synced_at).toBeDefined()
  })

  test('pushes all syncs when no selector provided', async () => {
    const previousBody = '# Remote Content'
    const localBodyOne = '# Updated Content One'
    const localBodyTwo = '# Updated Content Two'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/one.md',
          comment_id: 111,
          last_synced_hash: calculateHash(previousBody),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/two.md',
          comment_id: 222,
          last_synced_hash: calculateHash(previousBody),
        },
      ],
    }
    saveConfig(state, tempDir)

    await mkdir(path.join(tempDir, 'docs'), { recursive: true })
    await writeFile(path.join(tempDir, 'docs/one.md'), localBodyOne, 'utf-8')
    await writeFile(path.join(tempDir, 'docs/two.md'), localBodyTwo, 'utf-8')

    const updateComment = mock<GitHubClientInstance['updateComment']>((_, __, ___, body) =>
      Promise.resolve({
        id: 111,
        body,
        updated_at: '2025-01-01T00:00:00Z',
      }),
    )
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: (_, __, commentId) =>
        Promise.resolve({
          id: commentId,
          body: githubModule.addMarker(previousBody),
          updated_at: '2025-01-01T00:00:00Z',
        }),
      updateComment: (...args: Parameters<GitHubClientInstance['updateComment']>) =>
        updateComment(...args),
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await push({ cwd: tempDir })

    expect(updateComment).toHaveBeenCalledTimes(2)

    const updatedState = loadConfig(tempDir)
    const syncOne = updatedState.syncs.find((entry) => entry.local_file === 'docs/one.md')
    const syncTwo = updatedState.syncs.find((entry) => entry.local_file === 'docs/two.md')

    expect(syncOne?.last_synced_hash).toBe(calculateHash(localBodyOne))
    expect(syncTwo?.last_synced_hash).toBe(calculateHash(localBodyTwo))
    expect(syncOne?.last_synced_at).toBeDefined()
    expect(syncTwo?.last_synced_at).toBeDefined()
  })

  test('reports partial failures when some syncs fail', async () => {
    const previousBody = '# Remote Content'
    const localBodyOne = '# Updated Content One'
    const localBodyTwo = '# Updated Content Two'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: 'docs/one.md',
          comment_id: 111,
          last_synced_hash: calculateHash(previousBody),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: 'docs/two.md',
          comment_id: 222,
          last_synced_hash: calculateHash(previousBody),
        },
      ],
    }
    saveConfig(state, tempDir)

    await mkdir(path.join(tempDir, 'docs'), { recursive: true })
    await writeFile(path.join(tempDir, 'docs/one.md'), localBodyOne, 'utf-8')
    await writeFile(path.join(tempDir, 'docs/two.md'), localBodyTwo, 'utf-8')

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: (_, __, commentId) => {
        if (commentId === 111) {
          return Promise.resolve({
            id: 111,
            body: githubModule.addMarker(previousBody),
            updated_at: '2025-01-01T00:00:00Z',
          })
        }
        throw new Error('API Error: Rate limit exceeded')
      },
      updateComment: (_, __, commentId, body) => {
        if (commentId === 111) {
          return Promise.resolve({ id: 111, body, updated_at: '2025-01-01T00:00:00Z' })
        }
        throw new Error('API Error: Rate limit exceeded')
      },
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(push({ cwd: tempDir })).rejects.toThrow('1 of 2 push operation(s) failed')

    // Verify successful sync was updated
    const updatedState = loadConfig(tempDir)
    const syncOne = updatedState.syncs.find((entry) => entry.local_file === 'docs/one.md')
    const syncTwo = updatedState.syncs.find((entry) => entry.local_file === 'docs/two.md')

    expect(syncOne?.last_synced_hash).toBe(calculateHash(localBodyOne))
    expect(syncOne?.last_synced_at).toBeDefined()

    // Failed sync should still have old hash
    expect(syncTwo?.last_synced_hash).toBe(calculateHash(previousBody))
  })

  test('allows local files starting with double dots', async () => {
    const localBody = '# Updated Content'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: '..docs/plan.md',
          comment_id: 999,
        },
      ],
    }
    saveConfig(state, tempDir)

    await mkdir(path.join(tempDir, '..docs'), { recursive: true })
    await writeFile(path.join(tempDir, '..docs/plan.md'), localBody, 'utf-8')

    const updateComment = mock<GitHubClientInstance['updateComment']>(() =>
      Promise.resolve({
        id: 999,
        body: '',
        updated_at: '2025-01-01T00:00:00Z',
      }),
    )
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: () =>
        Promise.resolve({
          id: 999,
          body: githubModule.addMarker('# Remote Content'),
          updated_at: '2025-01-01T00:00:00Z',
        }),
      updateComment: (...args: Parameters<GitHubClientInstance['updateComment']>) =>
        updateComment(...args),
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    await push({ cwd: tempDir })

    expect(updateComment).toHaveBeenCalledTimes(1)
    const updatedState = loadConfig(tempDir)
    const sync = updatedState.syncs[0]
    expect(sync?.last_synced_hash).toBe(calculateHash(localBody))
  })

  test('auto-repairs remote comment when markers are missing', async () => {
    const previousBody = '# Content without markers'
    const localBody = '# Updated Content'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 123,
          last_synced_hash: calculateHash(previousBody),
        },
      ],
    }
    saveConfig(state, tempDir)

    await mkdir(path.join(tempDir, '.issync/docs'), { recursive: true })
    await writeFile(path.join(tempDir, '.issync/docs/plan-123.md'), localBody, 'utf-8')

    const updateComment = mock<GitHubClientInstance['updateComment']>(() =>
      Promise.resolve({
        id: 123,
        body: '',
        updated_at: '2025-01-01T00:00:00Z',
      }),
    )
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: () =>
        Promise.resolve({
          id: 123,
          body: previousBody, // No markers
          updated_at: '2025-01-01T00:00:00Z',
        }),
      updateComment: (...args: Parameters<GitHubClientInstance['updateComment']>) =>
        updateComment(...args),
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Act
    await push({ cwd: tempDir })

    // Assert
    expect(updateComment).toHaveBeenCalledTimes(2)
    expectNthCallContent(updateComment, 0, githubModule.addMarker(previousBody))
    expectNthCallContent(updateComment, 1, githubModule.addMarker(localBody))
  })

  test('force push skips optimistic lock check when remote hash differs', async () => {
    const previousBody = '# Remote Content'
    const remoteBody = '# Remote Content (modified by another session)'
    const localBody = '# Updated Content'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 123,
          last_synced_hash: calculateHash(previousBody),
        },
      ],
    }
    saveConfig(state, tempDir)

    await mkdir(path.join(tempDir, '.issync/docs'), { recursive: true })
    await writeFile(path.join(tempDir, '.issync/docs/plan-123.md'), localBody, 'utf-8')

    const updateComment = mock<GitHubClientInstance['updateComment']>(() =>
      Promise.resolve({
        id: 123,
        body: '',
        updated_at: '2025-01-01T00:00:00Z',
      }),
    )
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: () =>
        Promise.resolve({
          id: 123,
          body: githubModule.addMarker(remoteBody),
          updated_at: '2025-01-01T00:00:00Z',
        }),
      updateComment: (...args: Parameters<GitHubClientInstance['updateComment']>) =>
        updateComment(...args),
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Mock stdin as non-TTY to auto-confirm force push
    const originalIsTTY = process.stdin.isTTY
    ;(process.stdin as { isTTY?: boolean }).isTTY = false

    try {
      // Act - force push should succeed
      await push({ cwd: tempDir, force: true })

      // Assert
      expect(updateComment).toHaveBeenCalledTimes(1)
      expectNthCallContent(updateComment, 0, githubModule.addMarker(localBody))

      const updatedState = loadConfig(tempDir)
      const sync = updatedState.syncs[0]
      expect(sync?.last_synced_hash).toBe(calculateHash(localBody))
    } finally {
      // Restore original isTTY value
      ;(process.stdin as { isTTY?: boolean }).isTTY = originalIsTTY
    }
  })

  test('force push works even when remote hash matches', async () => {
    const previousBody = '# Content'
    const localBody = '# Updated Content'
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: '.issync/docs/plan-123.md',
          comment_id: 123,
          last_synced_hash: calculateHash(previousBody),
        },
      ],
    }
    saveConfig(state, tempDir)

    await mkdir(path.join(tempDir, '.issync/docs'), { recursive: true })
    await writeFile(path.join(tempDir, '.issync/docs/plan-123.md'), localBody, 'utf-8')

    const updateComment = mock<GitHubClientInstance['updateComment']>(() =>
      Promise.resolve({
        id: 123,
        body: '',
        updated_at: '2025-01-01T00:00:00Z',
      }),
    )
    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: () =>
        Promise.resolve({
          id: 123,
          body: githubModule.addMarker(previousBody),
          updated_at: '2025-01-01T00:00:00Z',
        }),
      updateComment: (...args: Parameters<GitHubClientInstance['updateComment']>) =>
        updateComment(...args),
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Mock stdin as non-TTY to auto-confirm force push
    const originalIsTTY = process.stdin.isTTY
    ;(process.stdin as { isTTY?: boolean }).isTTY = false

    try {
      // Act
      await push({ cwd: tempDir, force: true })

      // Assert
      expect(updateComment).toHaveBeenCalledTimes(1)
      expectNthCallContent(updateComment, 0, githubModule.addMarker(localBody))
    } finally {
      // Restore original isTTY value
      ;(process.stdin as { isTTY?: boolean }).isTTY = originalIsTTY
    }
  })
})

describe('confirmAction - force push confirmation prompt', () => {
  test('returns true in non-TTY mode (no user interaction required)', async () => {
    // Arrange - Mock non-TTY input stream (CI environment)
    const mockInput = new Readable({
      read() {},
    })
    ;(mockInput as unknown as { isTTY: boolean }).isTTY = false

    const mockOutput = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
    })

    // Act
    const result = await confirmAction(
      { message: '⚠️  Test warning' },
      mockInput as typeof process.stdin,
      mockOutput as typeof process.stdout,
    )

    // Assert - In non-TTY mode, always returns true
    expect(result).toBe(true)
  })
})

describe('push command - file not found guidance', () => {
  let tempDir: string
  let consoleErrorSpy: ReturnType<typeof spyOn>

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(import.meta.dir, '../../.test-tmp/push-guidance-'))
    await mkdir(path.join(tempDir, '.issync'), { recursive: true })
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
    consoleErrorSpy.mockRestore()
  })

  test('suggests clean command when file not found in multi-sync push', async () => {
    // Arrange - Create state with one existing file and one missing file
    const existingFile = path.join(tempDir, '.issync/docs/existing.md')
    const existingContent = '# Existing'
    await mkdir(path.dirname(existingFile), { recursive: true })
    await writeFile(existingFile, existingContent, 'utf-8')

    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: existingFile,
          comment_id: 123,
          last_synced_hash: calculateHash(existingContent), // Match with local content
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          local_file: path.join(tempDir, '.issync/docs/missing.md'), // File does not exist
          comment_id: 456,
          last_synced_hash: 'hash2',
        },
      ],
    }
    saveConfig(state, tempDir)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment' | 'updateComment'> = {
      getComment: (owner: string, repo: string, commentId: number) => {
        if (commentId === 123) {
          return Promise.resolve({
            id: 123,
            body: addMarker(existingContent), // Match with local and last_synced_hash
            updated_at: '2025-01-01T00:00:00Z',
          })
        }
        throw new Error('Comment not found')
      },
      updateComment: () =>
        Promise.resolve({
          id: 123,
          body: '',
          updated_at: '2025-01-01T00:00:00Z',
        }),
    }

    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    // Act & Assert
    try {
      await push({ cwd: tempDir })
      throw new Error('Expected push to fail')
    } catch (error) {
      // Expect failure due to missing file
      expect(error).toBeInstanceOf(Error)
      if (error instanceof Error) {
        expect(error.message).toContain('push operation(s) failed')
      }
    }

    // Verify clean command guidance is displayed
    expect(consoleErrorSpy).toHaveBeenCalledWith('\n💡 Tip: Remove stale sync configurations with:')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '  issync clean --dry-run  # Preview what will be removed',
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '  issync clean            # Remove with confirmation',
    )
  })
})
