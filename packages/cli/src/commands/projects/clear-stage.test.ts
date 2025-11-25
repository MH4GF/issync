import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { clearStage } from './clear-stage'

describe('clearStage command', () => {
  const originalEnv = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    ISSYNC_GITHUB_PROJECTS_NUMBER: process.env.ISSYNC_GITHUB_PROJECTS_NUMBER,
    ISSYNC_GITHUB_PROJECTS_OWNER: process.env.ISSYNC_GITHUB_PROJECTS_OWNER,
  }

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'ghp_test_token_123456789012345678901234'
    process.env.ISSYNC_GITHUB_PROJECTS_NUMBER = '42'
    process.env.ISSYNC_GITHUB_PROJECTS_OWNER = 'test-owner'
  })

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalEnv.GITHUB_TOKEN
    process.env.ISSYNC_GITHUB_PROJECTS_NUMBER = originalEnv.ISSYNC_GITHUB_PROJECTS_NUMBER
    process.env.ISSYNC_GITHUB_PROJECTS_OWNER = originalEnv.ISSYNC_GITHUB_PROJECTS_OWNER
  })

  test('logs warning on error instead of throwing', async () => {
    const consoleErrorSpy = spyOn(console, 'error')
    const consoleLogSpy = spyOn(console, 'log')

    // Clear any previous calls from other tests
    consoleErrorSpy.mockClear()
    consoleLogSpy.mockClear()

    // Missing env vars will cause error
    delete process.env.ISSYNC_GITHUB_PROJECTS_NUMBER

    await clearStage({
      issueUrl: 'https://github.com/owner/repo/issues/123',
    })

    // Should log warning, not throw
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️'))
    expect(consoleLogSpy).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })
})
