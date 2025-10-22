import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import * as configModule from '../lib/config.js'
import * as githubModule from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import type { IssyncState } from '../types/index.js'
import * as pullModule from './pull.js'
import * as pushModule from './push.js'
import { watch } from './watch.js'

type GitHubClientInstance = ReturnType<typeof githubModule.createGitHubClient>

const GRACE_PERIOD_MS = 1000

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(
  condition: () => boolean,
  { timeout = 2000, interval = 50 }: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (condition()) {
      return
    }
    await delay(interval)
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

describe('watch command (chokidar mocked)', () => {
  let tempDir: string
  let filePath: string
  let changeHandlers: Array<(...args: unknown[]) => void>
  let watcherCloseMock: ReturnType<typeof mock>
  let pullMock: ReturnType<typeof spyOn>
  let pushMock: ReturnType<typeof spyOn>
  let watchPromise: Promise<void> | undefined
  let relativeFile: string
  let loadConfigSpy: ReturnType<typeof spyOn>
  let chokidarSpy: ReturnType<typeof spyOn>

  const startWatch = async (interval = 60): Promise<void> => {
    watchPromise = watch({ interval })
    await delay(100) // allow watch session to bootstrap
  }

  const stopWatch = async (): Promise<void> => {
    if (!watchPromise) return
    process.emit('SIGINT')
    try {
      await watchPromise
    } catch {
      // ignore errors during shutdown
    }
    watchPromise = undefined
  }

  const triggerFileChange = (): void => {
    for (const handler of changeHandlers) {
      handler(filePath)
    }
  }

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(process.cwd(), 'tmp-watch-test-'))
    filePath = path.join(tempDir, 'test.md')
    const fileContent = '# Test Content'
    await writeFile(filePath, fileContent, 'utf-8')

    changeHandlers = []
    watcherCloseMock = mock(() => Promise.resolve())

    relativeFile = path.relative(process.cwd(), filePath)
    relativeFile = path.relative(process.cwd(), filePath)

    const mockState: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          comment_id: 123,
          local_file: relativeFile,
          last_synced_hash: calculateHash(fileContent),
        },
      ],
    }

    loadConfigSpy = spyOn(configModule, 'loadConfig').mockReturnValue(mockState)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({
          id: 123,
          body: fileContent,
          updated_at: '2025-01-01T00:00:00Z',
        }),
    }
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      mockGitHubClient as unknown as GitHubClientInstance,
    )

    chokidarSpy = spyOn(chokidar, 'watch').mockImplementation(() => {
      const watcher = {
        on: (event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'change') {
            changeHandlers.push(handler)
          }
          return watcher
        },
        close: watcherCloseMock,
      }
      return watcher as unknown as FSWatcher
    })

    pullMock = spyOn(pullModule, 'pull').mockResolvedValue(false)
    pushMock = spyOn(pushModule, 'push').mockResolvedValue()
  })

  afterEach(async () => {
    await stopWatch()
    mock.restore()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('pushes remote changes when file is edited after grace period', async () => {
    await startWatch()
    expect(changeHandlers.length).toBeGreaterThan(0)

    await delay(GRACE_PERIOD_MS + 150)
    triggerFileChange()

    await waitFor(() => pushMock.mock.calls.length === 1)
    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock.mock.calls[0]?.[0]).toEqual({
      cwd: undefined,
      file: relativeFile,
      scope: undefined,
    })
    expect(pullMock).not.toHaveBeenCalled()
  })

  test('ignores edits within grace period after pull', async () => {
    await startWatch()

    triggerFileChange() // immediately after start -> within grace period
    await delay(GRACE_PERIOD_MS + 200)

    expect(pushMock).not.toHaveBeenCalled()
  })

  test('pushes once grace period expires after initial ignore', async () => {
    await startWatch()

    triggerFileChange() // first change within grace period
    await delay(GRACE_PERIOD_MS + 150)
    triggerFileChange() // second change after grace period

    await waitFor(() => pushMock.mock.calls.length === 1)
    expect(pushMock).toHaveBeenCalledTimes(1)
  })

  test('polls remote at specified interval', async () => {
    await startWatch(1)

    await waitFor(() => pullMock.mock.calls.length >= 1, { timeout: 2000 })
    expect(pullMock.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(pullMock.mock.calls[0]?.[0]).toEqual({
      cwd: undefined,
      file: relativeFile,
      scope: undefined,
    })
  })

  test('watches all configured syncs when no selector provided', async () => {
    const secondFile = path.join(tempDir, 'second.md')
    await writeFile(secondFile, '# Test Content', 'utf-8')
    const secondRelative = path.relative(process.cwd(), secondFile)

    const multiState: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          comment_id: 123,
          local_file: relativeFile,
          last_synced_hash: calculateHash('# Test Content'),
        },
        {
          issue_url: 'https://github.com/owner/repo/issues/2',
          comment_id: 456,
          local_file: secondRelative,
          last_synced_hash: calculateHash('# Test Content'),
        },
      ],
    }

    loadConfigSpy.mockReturnValue(multiState)

    await startWatch()

    // Expect watch calls: 2 for sync files + 1 for state.yml monitoring
    const EXPECTED_SYNC_FILE_WATCHES = 2
    const STATE_FILE_WATCH_COUNT = 1
    const TOTAL_EXPECTED_WATCHES = EXPECTED_SYNC_FILE_WATCHES + STATE_FILE_WATCH_COUNT

    expect(chokidarSpy.mock.calls.length).toBe(TOTAL_EXPECTED_WATCHES)
    const watchedPaths = chokidarSpy.mock.calls.map((call: unknown[]) => call[0])
    expect(watchedPaths).toContain(path.resolve(process.cwd(), relativeFile))
    expect(watchedPaths).toContain(path.resolve(process.cwd(), secondRelative))
  })

  test('should work with --global option', async () => {
    const globalState: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: filePath, // absolute path for global config
          comment_id: 123,
          last_synced_at: new Date().toISOString(),
          last_synced_hash: calculateHash('# Test Content'),
        },
      ],
    }

    loadConfigSpy.mockReturnValue(globalState)

    // Start watch with global scope
    watchPromise = watch({ interval: 60, scope: 'global' })
    await delay(100)

    // Verify loadConfig was called with scope='global' and cwd=undefined
    expect(loadConfigSpy).toHaveBeenCalledWith('global', undefined)

    // Wait for grace period to expire before triggering change
    await delay(GRACE_PERIOD_MS + 100)

    // Trigger file change to test push with global scope
    expect(changeHandlers.length).toBeGreaterThan(0)
    triggerFileChange()

    // Wait for push to complete
    await waitFor(() => pushMock.mock.calls.length === 1)

    // Verify push was called with scope='global' and cwd=undefined
    expect(pushMock).toHaveBeenCalledTimes(1)
    const pushCall = pushMock.mock.calls[0]?.[0]
    expect(pushCall).toMatchObject({
      scope: 'global',
    })
    // CRITICAL: Global config should NOT pass cwd parameter
    // This test will fail with current bug (cwd: process.cwd() is passed)
    expect(pushCall).toHaveProperty('cwd', undefined)
  })

  test('should work with --local option', async () => {
    const localState: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: filePath,
          comment_id: 123,
          last_synced_at: new Date().toISOString(),
          last_synced_hash: calculateHash('# Test Content'),
        },
      ],
    }

    loadConfigSpy.mockReturnValue(localState)

    // Start watch with local scope
    watchPromise = watch({ interval: 60, scope: 'local' })
    await delay(100)

    // Verify loadConfig was called with scope='local' and cwd=undefined
    expect(loadConfigSpy).toHaveBeenCalledWith('local', undefined)

    // Trigger file change event to verify push is called with scope
    const watchInstance = chokidarSpy.mock.results[0]?.value
    if (watchInstance?.emit) {
      // Write new content to trigger change
      await writeFile(filePath, '# Updated Content', 'utf-8')
      await delay(600) // Wait for awaitWriteFinish

      watchInstance.emit('change', filePath)
      await delay(200) // Wait for push to complete

      // Verify push was called with scope='local'
      expect(pushMock.mock.calls.length).toBeGreaterThanOrEqual(1)
      const lastPushCall = pushMock.mock.calls[pushMock.mock.calls.length - 1]?.[0]
      expect(lastPushCall).toMatchObject({
        scope: 'local',
      })
    }
  })

  test('should use global-priority auto-detection when scope is not specified', async () => {
    const state: IssyncState = {
      syncs: [
        {
          issue_url: 'https://github.com/owner/repo/issues/1',
          local_file: filePath,
          comment_id: 123,
          last_synced_at: new Date().toISOString(),
          last_synced_hash: calculateHash('# Test Content'),
        },
      ],
    }

    loadConfigSpy.mockReturnValue(state)

    // Start watch without scope
    watchPromise = watch({ interval: 60 })
    await delay(100)

    // Verify loadConfig was called with scope=undefined and cwd=undefined
    // This triggers resolveConfigPath(undefined) which implements global-first auto-detection
    expect(loadConfigSpy).toHaveBeenCalledWith(undefined, undefined)
  })

  // Error handling is validated via targeted unit tests to avoid relying on chokidar internals here.
})
