import { describe, expect, spyOn, test } from 'bun:test'
import { GitHubClient, parseIssueUrl } from './github'

describe('parseIssueUrl', () => {
  test('can parse standard GitHub Issue URL', () => {
    const result = parseIssueUrl('https://github.com/owner/repo/issues/123')

    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      issue_number: 123,
    })
  })

  test('can parse URL with http protocol', () => {
    const result = parseIssueUrl('http://github.com/owner/repo/issues/456')

    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      issue_number: 456,
    })
  })

  test('can parse URL with query parameters', () => {
    const result = parseIssueUrl('https://github.com/owner/repo/issues/789?foo=bar')

    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      issue_number: 789,
    })
  })

  test('throws error if not an Issue URL', () => {
    expect(() => parseIssueUrl('https://github.com/owner/repo')).toThrow()
  })

  test('throws error for Pull Request URL', () => {
    expect(() => parseIssueUrl('https://github.com/owner/repo/pull/123')).toThrow()
  })

  test('throws error for non-GitHub URL', () => {
    expect(() => parseIssueUrl('https://example.com/owner/repo/issues/123')).toThrow()
  })

  test('throws error for invalid format', () => {
    expect(() => parseIssueUrl('not a url')).toThrow()
  })
})

describe('GitHubClient constructor', () => {
  const VALID_TOKEN_LENGTH = 36

  describe.each([
    { prefix: 'ghp', description: 'Personal Access Token' },
    { prefix: 'ghs', description: 'Server Token' },
    { prefix: 'gho', description: 'Fine-grained Personal Access Token' },
  ])('$prefix_ token ($description)', ({ prefix }) => {
    test('accepts valid token without warning', () => {
      const consoleWarnSpy = spyOn(console, 'warn')
      const validToken = `${prefix}_${'a'.repeat(VALID_TOKEN_LENGTH)}`

      new GitHubClient(validToken)

      expect(consoleWarnSpy).not.toHaveBeenCalled()
      consoleWarnSpy.mockRestore()
    })
  })

  test('shows warning for invalid token format', () => {
    const consoleWarnSpy = spyOn(console, 'warn')
    const invalidToken = 'invalid_token'

    new GitHubClient(invalidToken)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GitHub token format appears invalid'),
    )
    consoleWarnSpy.mockRestore()
  })

  test('throws error when token is missing', () => {
    const originalEnv = process.env.GITHUB_TOKEN
    delete process.env.GITHUB_TOKEN

    expect(() => new GitHubClient()).toThrow('GitHub token required')

    process.env.GITHUB_TOKEN = originalEnv
  })
})
