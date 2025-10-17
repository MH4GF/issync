import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as githubModule from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import type { IssyncSync } from '../types/index.js'
import * as pullModule from './pull.js'
import * as pushModule from './push.js'
import { _performSafetyCheck } from './watch.js'

type GitHubClientInstance = ReturnType<typeof githubModule.createGitHubClient>

describe('watch command - unit tests', () => {
  let tempDir: string
  let relativeFile: string
  let absoluteFile: string

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await mkdtemp(path.join(process.cwd(), 'tmp-watch-unit-'))

    // Create a test file
    absoluteFile = path.join(tempDir, 'test.md')
    await writeFile(absoluteFile, '# Test Content', 'utf-8')
    relativeFile = path.relative(process.cwd(), absoluteFile)
  })

  afterEach(async () => {
    mock.restore()

    // Cleanup temp directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('_performSafetyCheck (3-way comparison)', () => {
    test('should throw when comment_id is missing', () => {
      const mockConfig: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        local_file: relativeFile,
      }

      return expect(_performSafetyCheck(mockConfig)).rejects.toThrow(
        `No comment_id found for sync "${mockConfig.issue_url}". Please run "issync push" for this sync before starting watch mode.`,
      )
    })

    test('should pull when no last_synced_hash exists', async () => {
      const content = '# Test Content'
      const mockConfig: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123,
        local_file: relativeFile,
      }

      const pullMock = spyOn(pullModule, 'pull').mockImplementation(() => Promise.resolve())
      const pushMock = spyOn(pushModule, 'push').mockImplementation(() => Promise.resolve())

      const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
        getComment: () =>
          Promise.resolve({ id: 123, body: content, updated_at: '2025-01-01T00:00:00Z' }),
      }
      spyOn(githubModule, 'createGitHubClient').mockReturnValue(
        mockGitHubClient as unknown as GitHubClientInstance,
      )

      await _performSafetyCheck(mockConfig)

      expect(pullMock).toHaveBeenCalledTimes(1)
      expect(pullMock.mock.calls[0]?.[0]).toEqual({
        cwd: process.cwd(),
        file: relativeFile,
      })
      expect(pushMock).not.toHaveBeenCalled()
    })

    test('should restore from remote when local file is missing', async () => {
      const content = '# Test Content'
      const mockConfig: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123,
        local_file: relativeFile,
        last_synced_hash: calculateHash(content),
      }

      await rm(absoluteFile)

      const pullMock = spyOn(pullModule, 'pull').mockImplementation(() => Promise.resolve())
      const pushMock = spyOn(pushModule, 'push').mockImplementation(() => Promise.resolve())
      const githubClientSpy = spyOn(githubModule, 'createGitHubClient')

      await _performSafetyCheck(mockConfig)

      expect(pullMock).toHaveBeenCalledTimes(1)
      expect(pullMock.mock.calls[0]?.[0]).toEqual({
        cwd: process.cwd(),
        file: relativeFile,
      })
      expect(pushMock).not.toHaveBeenCalled()
      expect(githubClientSpy).not.toHaveBeenCalled()
    })

    test('should throw conflict error when both local and remote changed', async () => {
      // Arrange: Create file with different content than remote
      const localContent = '# Local changes'
      const remoteContent = '# Remote changes'
      const lastSyncedContent = '# Original content'

      const mockConfig: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123,
        local_file: relativeFile,
        last_synced_hash: calculateHash(lastSyncedContent),
      }

      await writeFile(absoluteFile, localContent, 'utf-8')

      // Mock GitHub client to return remote content
      const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
        getComment: () =>
          Promise.resolve({ id: 123, body: remoteContent, updated_at: '2025-01-01T00:00:00Z' }),
      }
      spyOn(githubModule, 'createGitHubClient').mockReturnValue(
        mockGitHubClient as unknown as GitHubClientInstance,
      )

      // Act & Assert: Should throw conflict error
      return expect(_performSafetyCheck(mockConfig)).rejects.toThrow('CONFLICT DETECTED')
    })

    test('should auto-push when only local changed', async () => {
      // Arrange: Local has changes, remote matches last_synced_hash
      const localContent = '# Local changes'
      const remoteContent = '# Original content'
      const lastSyncedContent = '# Original content'

      const mockConfig: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123,
        local_file: relativeFile,
        last_synced_hash: calculateHash(lastSyncedContent),
      }

      await writeFile(absoluteFile, localContent, 'utf-8')

      // Mock GitHub client to return remote content
      const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
        getComment: () =>
          Promise.resolve({ id: 123, body: remoteContent, updated_at: '2025-01-01T00:00:00Z' }),
      }
      spyOn(githubModule, 'createGitHubClient').mockReturnValue(
        mockGitHubClient as unknown as GitHubClientInstance,
      )

      const pushMock = spyOn(pushModule, 'push').mockImplementation(() => Promise.resolve())
      const pullMock = spyOn(pullModule, 'pull').mockImplementation(() => Promise.resolve())

      // Act: Call safety check directly
      await _performSafetyCheck(mockConfig)

      // Assert: Should have called push (not pull)
      expect(pushMock).toHaveBeenCalledTimes(1)
      expect(pushMock.mock.calls[0]?.[0]).toEqual({
        cwd: process.cwd(),
        file: relativeFile,
      })
      expect(pullMock).not.toHaveBeenCalled()
    })

    test('should auto-pull when only remote changed', async () => {
      // Arrange: Remote has changes, local matches last_synced_hash
      // Use the content from beforeEach to avoid chokidar detecting file changes
      const remoteContent = '# Remote changes'
      const lastSyncedContent = '# Test Content'

      const mockConfig: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123,
        local_file: relativeFile,
        last_synced_hash: calculateHash(lastSyncedContent),
      }

      // Mock GitHub client to return remote content
      const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
        getComment: () =>
          Promise.resolve({ id: 123, body: remoteContent, updated_at: '2025-01-01T00:00:00Z' }),
      }
      spyOn(githubModule, 'createGitHubClient').mockReturnValue(
        mockGitHubClient as unknown as GitHubClientInstance,
      )

      const pushMock = spyOn(pushModule, 'push').mockImplementation(() => Promise.resolve())
      const pullMock = spyOn(pullModule, 'pull').mockImplementation(() => Promise.resolve())

      // Act: Call safety check directly
      await _performSafetyCheck(mockConfig)

      // Assert: Should have called pull (not push)
      expect(pullMock).toHaveBeenCalledTimes(1)
      expect(pullMock.mock.calls[0]?.[0]).toEqual({
        cwd: process.cwd(),
        file: relativeFile,
      })
      expect(pushMock).not.toHaveBeenCalled()
    })

    test('should not sync when neither side changed', async () => {
      // Arrange: Both local and remote match last_synced_hash
      // Use the content from beforeEach to avoid chokidar detecting file changes
      const content = '# Test Content'

      const mockConfig: IssyncSync = {
        issue_url: 'https://github.com/owner/repo/issues/1',
        comment_id: 123,
        local_file: relativeFile,
        last_synced_hash: calculateHash(content),
      }

      // Mock GitHub client to return same content
      const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
        getComment: () =>
          Promise.resolve({ id: 123, body: content, updated_at: '2025-01-01T00:00:00Z' }),
      }
      spyOn(githubModule, 'createGitHubClient').mockReturnValue(
        mockGitHubClient as unknown as GitHubClientInstance,
      )

      const pushMock = spyOn(pushModule, 'push').mockImplementation(() => Promise.resolve())
      const pullMock = spyOn(pullModule, 'pull').mockImplementation(() => Promise.resolve())

      // Act: Call safety check directly
      await _performSafetyCheck(mockConfig)

      // Assert: Should NOT have called push or pull (no changes)
      expect(pushMock).not.toHaveBeenCalled()
      expect(pullMock).not.toHaveBeenCalled()
    })
  })
})
