import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as configModule from '../lib/config.js'
import type { IssyncConfig } from '../types/index.js'
import * as pullModule from './pull.js'
import * as pushModule from './push.js'
import { OptimisticLockError } from './push.js'
import { watch } from './watch.js'

// Test timing constants
const GRACE_PERIOD_MS = 1000
const CHOKIDAR_STABILITY_MS = 500
const WATCH_INIT_WAIT_MS = GRACE_PERIOD_MS + 200 // Grace period + buffer
const _SHORT_WAIT_MS = 200 // For initial pull completion
const _PUSH_WAIT_BUFFER_MS = 500 // Extra buffer to ensure push would have been called if not ignored

/**
 * Wait for a condition to be true
 */
async function waitFor(
  condition: () => boolean,
  { timeout = 5000, interval = 100 }: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

describe('watch command', () => {
  let tempDir: string
  let watchPromise: Promise<void>

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await mkdtemp(path.join(tmpdir(), 'issync-test-'))

    // Create a test file
    await writeFile(path.join(tempDir, 'test.md'), '# Test Content', 'utf-8')
  })

  afterEach(async () => {
    // Send SIGINT to stop watch if it's running
    if (watchPromise !== undefined) {
      process.emit('SIGINT')

      // Wait for watch to stop (with timeout)
      await Promise.race([
        watchPromise.catch(() => {
          // Ignore errors (test may have already failed)
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])
    }

    // Cleanup temp directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('should perform initial pull on startup', async () => {
    // Arrange: Mock config and pull
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    const pullMock = spyOn(pullModule, 'pull').mockResolvedValue()

    // Act: Start watch in background
    watchPromise = watch({ interval: 60 })

    // Wait for initial pull
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Assert: Initial pull should be called
    expect(pullMock).toHaveBeenCalledTimes(1)

    // Cleanup
    process.emit('SIGINT')
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  test('should handle initial pull failure', async () => {
    // Arrange: Mock config and failing pull
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    spyOn(pullModule, 'pull').mockRejectedValue(new Error('Network error'))

    // Act & Assert: Watch should throw on initial pull failure
    // Note: Bun Test's expect().rejects returns a thenable that must be awaited
    // ESLint incorrectly reports this as non-thenable due to Bun Test type definitions
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(watch({ interval: 60 })).rejects.toThrow('Network error')
  })

  test('should push when local file changes', async () => {
    // Arrange: Mock config, pull, and push
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    spyOn(pullModule, 'pull').mockResolvedValue()
    const pushMock = spyOn(pushModule, 'push').mockResolvedValue()

    // Act: Start watch with long interval (to avoid polling during test)
    watchPromise = watch({ interval: 60 })

    // Wait for watch to initialize and for pull grace period to expire
    await new Promise((resolve) => setTimeout(resolve, WATCH_INIT_WAIT_MS))

    // Trigger file change
    await writeFile(mockConfig.local_file, '# Updated content', 'utf-8')

    // Wait for push to be called (with timeout)
    await waitFor(() => pushMock.mock.calls.length > 0, { timeout: 2000 })

    // Assert
    expect(pushMock).toHaveBeenCalledTimes(1)

    // Cleanup
    process.emit('SIGINT')
  })

  test('should poll remote at specified interval', async () => {
    // Arrange: Mock config and pull
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    const pullMock = spyOn(pullModule, 'pull').mockResolvedValue()

    // Act: Start watch with 1 second interval
    watchPromise = watch({ interval: 1 })

    // Wait for initial pull + at least one poll
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Assert: Should have been called at least twice (initial + 1 poll)
    expect(pullMock.mock.calls.length).toBeGreaterThanOrEqual(2)

    // Cleanup
    process.emit('SIGINT')
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  test('should handle pull errors during polling without crashing', async () => {
    // Arrange: Mock config and failing pull
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)

    let callCount = 0
    const pullMock = spyOn(pullModule, 'pull').mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Initial pull succeeds
        return Promise.resolve()
      }
      // Subsequent polls fail
      return Promise.reject(new Error('API error'))
    })

    // Act: Start watch with 1 second interval
    watchPromise = watch({ interval: 1 })

    // Wait for initial pull + at least one failing poll
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Assert: Watch should still be running (no crash)
    // If it crashed, the test would fail
    expect(pullMock.mock.calls.length).toBeGreaterThanOrEqual(2)

    // Cleanup
    process.emit('SIGINT')
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  test('should handle push errors without crashing', async () => {
    // Arrange: Mock config, pull, and failing push
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    spyOn(pullModule, 'pull').mockResolvedValue()
    const pushMock = spyOn(pushModule, 'push').mockImplementation(() => {
      return Promise.reject(new Error('API error'))
    })

    // Act: Start watch
    watchPromise = watch({ interval: 60 })

    // Wait for watch to initialize and for pull grace period to expire
    await new Promise((resolve) => setTimeout(resolve, WATCH_INIT_WAIT_MS))

    // Trigger file change
    await writeFile(mockConfig.local_file, '# Updated content', 'utf-8')

    // Wait for push to be called
    await waitFor(() => pushMock.mock.calls.length > 0, { timeout: 2000 })

    // Wait a bit more to ensure watch doesn't crash
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Assert: Watch should still be running (no crash)
    // If it crashed, the test would fail
    expect(pushMock).toHaveBeenCalledTimes(1)

    // Cleanup
    process.emit('SIGINT')
  })

  test('should handle OptimisticLockError with specific message', async () => {
    // Arrange: Mock config, pull, and push that throws OptimisticLockError
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    spyOn(pullModule, 'pull').mockResolvedValue()
    const pushMock = spyOn(pushModule, 'push').mockImplementation(() => {
      return Promise.reject(new OptimisticLockError())
    })

    // Spy on console.error
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})

    // Act: Start watch
    watchPromise = watch({ interval: 60 })

    // Wait for watch to initialize and for pull grace period to expire
    await new Promise((resolve) => setTimeout(resolve, WATCH_INIT_WAIT_MS))

    // Trigger file change
    await writeFile(mockConfig.local_file, '# Updated content', 'utf-8')

    // Wait for push to be called
    await waitFor(() => pushMock.mock.calls.length > 0, { timeout: 2000 })

    // Wait for error message to be logged
    await waitFor(() => consoleErrorSpy.mock.calls.length > 0, { timeout: 1000 })

    // Assert: Should have logged conflict message
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Conflict detected'))
    expect(pushMock).toHaveBeenCalledTimes(1)

    // Cleanup
    process.emit('SIGINT')
  })

  test('should apply exponential backoff after consecutive errors', async () => {
    // Arrange: Mock config and pull that fails multiple times
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)

    let callCount = 0
    const pullMock = spyOn(pullModule, 'pull').mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Initial pull succeeds
        return Promise.resolve()
      }
      // Subsequent polls fail
      return Promise.reject(new Error('API error'))
    })

    // Act: Start watch with 500ms interval
    watchPromise = watch({ interval: 0.5 })

    // Wait for initial pull + several failing polls (3 seconds)
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Assert: Should have backed off
    // Without backoff at 500ms interval: ~6 calls (1 initial + 5 polls in 3s)
    // With exponential backoff (1s, 2s):
    //   t=0: initial (success)
    //   t=0.5s: poll 1 (fail, backoff 1s)
    //   t=1.5s: poll 2 (fail, backoff 2s)
    //   Total: ~3 calls in 3s
    expect(pullMock.mock.calls.length).toBeLessThan(6)
    expect(pullMock.mock.calls.length).toBeGreaterThanOrEqual(2)

    // Cleanup
    process.emit('SIGINT')
  })

  test('should ignore file changes within grace period after pull', async () => {
    // Arrange: Mock config, pull, and push
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    spyOn(pullModule, 'pull').mockResolvedValue()
    const pushMock = spyOn(pushModule, 'push').mockResolvedValue()

    // Act: Start watch
    watchPromise = watch({ interval: 60 })

    // Wait for initial pull to complete (short wait)
    await new Promise((resolve) => setTimeout(resolve, SHORT_WAIT_MS))

    // Trigger file change within grace period (500ms after pull)
    await writeFile(mockConfig.local_file, '# Changed during grace', 'utf-8')

    // Wait for chokidar to stabilize + extra time to ensure push would have been called if not ignored
    await new Promise((resolve) => setTimeout(resolve, CHOKIDAR_STABILITY_MS + PUSH_WAIT_BUFFER_MS))

    // Assert: push should NOT have been called
    expect(pushMock).not.toHaveBeenCalled()

    // Cleanup
    process.emit('SIGINT')
  })

  test('should push file changes after grace period expires', async () => {
    // Arrange: Mock config, pull, and push
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    spyOn(pullModule, 'pull').mockResolvedValue()
    const pushMock = spyOn(pushModule, 'push').mockResolvedValue()

    // Act: Start watch
    watchPromise = watch({ interval: 60 })

    // Wait for grace period to fully expire (1000ms + chokidar stability + buffer)
    await new Promise((resolve) =>
      setTimeout(resolve, GRACE_PERIOD_MS + CHOKIDAR_STABILITY_MS + 300),
    )

    // Trigger file change after grace period
    await writeFile(mockConfig.local_file, '# Changed after grace', 'utf-8')

    // Wait for push to be called
    await waitFor(() => pushMock.mock.calls.length > 0, { timeout: 2000 })

    // Assert: push should have been called
    expect(pushMock).toHaveBeenCalledTimes(1)

    // Cleanup
    process.emit('SIGINT')
  })

  test('should ignore file changes exactly at grace period boundary (1000ms)', async () => {
    // Arrange: Mock config, pull, and push
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    spyOn(pullModule, 'pull').mockResolvedValue()
    const pushMock = spyOn(pushModule, 'push').mockResolvedValue()

    // Act: Start watch
    watchPromise = watch({ interval: 60 })

    // Wait for initial pull to complete
    await new Promise((resolve) => setTimeout(resolve, SHORT_WAIT_MS))

    // Wait exactly to grace period boundary (1000ms)
    await new Promise((resolve) => setTimeout(resolve, GRACE_PERIOD_MS - SHORT_WAIT_MS))

    // Trigger file change at boundary
    await writeFile(mockConfig.local_file, '# Changed at 1000ms', 'utf-8')

    // Wait for chokidar to stabilize + extra time to ensure push would have been called if not ignored
    await new Promise((resolve) => setTimeout(resolve, CHOKIDAR_STABILITY_MS + PUSH_WAIT_BUFFER_MS))

    // Assert: push should NOT have been called (< PULL_GRACE_PERIOD_MS)
    expect(pushMock).not.toHaveBeenCalled()

    // Cleanup
    process.emit('SIGINT')
  })

  test('should push file changes just after grace period (>1000ms)', async () => {
    // Arrange: Mock config, pull, and push
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    spyOn(pullModule, 'pull').mockResolvedValue()
    const pushMock = spyOn(pushModule, 'push').mockResolvedValue()

    // Act: Start watch
    watchPromise = watch({ interval: 60 })

    // Wait for initial pull to complete
    await new Promise((resolve) => setTimeout(resolve, SHORT_WAIT_MS))

    // Wait just over grace period (1000ms + 50ms margin)
    await new Promise((resolve) => setTimeout(resolve, GRACE_PERIOD_MS - SHORT_WAIT_MS + 50))

    // Trigger file change just after grace period
    await writeFile(mockConfig.local_file, '# Changed just after grace', 'utf-8')

    // Wait for push to be called
    await waitFor(() => pushMock.mock.calls.length > 0, { timeout: 2000 })

    // Assert: push should have been called
    expect(pushMock).toHaveBeenCalledTimes(1)

    // Cleanup
    process.emit('SIGINT')
  })

  test('should reset grace period after each polling pull', async () => {
    // Arrange: Mock config, pull, and push
    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: path.join(tempDir, 'test.md'),
      last_synced_hash: 'abc123',
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)
    const pullMock = spyOn(pullModule, 'pull').mockResolvedValue()
    const pushMock = spyOn(pushModule, 'push').mockResolvedValue()

    // Act: Start watch with 1 second interval
    watchPromise = watch({ interval: 1 })

    // Wait for initial pull + one polling pull (1s interval + buffer)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Verify we've had at least 2 pulls (initial + 1 polling)
    expect(pullMock.mock.calls.length).toBeGreaterThanOrEqual(2)

    // Trigger file change within grace period of most recent pull
    await writeFile(mockConfig.local_file, '# Changed after polling pull', 'utf-8')

    // Wait for chokidar to stabilize + extra time to ensure push would have been called if not ignored
    await new Promise((resolve) => setTimeout(resolve, CHOKIDAR_STABILITY_MS + PUSH_WAIT_BUFFER_MS))

    // Assert: push should NOT have been called (within grace period of most recent pull)
    expect(pushMock).not.toHaveBeenCalled()

    // Cleanup
    process.emit('SIGINT')
  })
})
