import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import chokidar from 'chokidar'
import * as configModule from '../lib/config.js'
import * as githubModule from '../lib/github.js'
import { calculateHash } from '../lib/hash.js'
import type { IssyncConfig } from '../types/index.js'
import * as pullModule from './pull.js'
import * as pushModule from './push.js'
import { watch } from './watch.js'

type GitHubClientInstance = InstanceType<typeof githubModule.GitHubClient>

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

    const mockConfig: IssyncConfig = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: filePath,
      last_synced_hash: calculateHash(fileContent),
    }

    spyOn(configModule, 'loadConfig').mockReturnValue(mockConfig)

    const mockGitHubClient: Pick<GitHubClientInstance, 'getComment'> = {
      getComment: () =>
        Promise.resolve({
          id: 123,
          body: fileContent,
          updated_at: '2025-01-01T00:00:00Z',
        }),
    }
    spyOn(githubModule, 'GitHubClient').mockImplementation(
      () => mockGitHubClient as unknown as githubModule.GitHubClient,
    )

    spyOn(chokidar, 'watch').mockImplementation(() => {
      const watcher = {
        on: (event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'change') {
            changeHandlers.push(handler)
          }
          return watcher
        },
        close: watcherCloseMock,
      }
      return watcher as unknown as chokidar.FSWatcher
    })

    pullMock = spyOn(pullModule, 'pull').mockResolvedValue()
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
    expect(pullMock.mock.calls[0]?.[0]).toEqual({ cwd: process.cwd() })
  })
  // Error handling is validated via targeted unit tests to avoid relying on chokidar internals here.
})
