import { describe, expect, test } from 'bun:test'
import { parseIssueUrl } from './github'

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
