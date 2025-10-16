import { describe, expect, spyOn, test } from 'bun:test'
import { addMarker, GitHubClient, hasIssyncMarker, parseIssueUrl, removeMarker } from './github'

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

describe('issync marker utilities', () => {
  describe('addMarker', () => {
    test('adds marker to the beginning of content', () => {
      const content = 'Hello World'
      const result = addMarker(content)

      expect(result).toBe(`<!-- issync:v1 -->\nHello World`)
    })

    test('handles empty content', () => {
      const result = addMarker('')

      expect(result).toBe(`<!-- issync:v1 -->\n`)
    })

    test('handles multiline content', () => {
      const content = 'Line 1\nLine 2\nLine 3'
      const result = addMarker(content)

      expect(result).toStartWith('<!-- issync:v1 -->')
      expect(result).toContain(content)
    })
  })

  describe('hasIssyncMarker', () => {
    test('returns true when marker is at the beginning', () => {
      const body = '<!-- issync:v1 -->\nContent here'

      expect(hasIssyncMarker(body)).toBe(true)
    })

    test('returns false when no marker is present', () => {
      const body = 'Regular comment content'

      expect(hasIssyncMarker(body)).toBe(false)
    })

    test('returns false when marker is not at the beginning', () => {
      const body = 'Some content\n<!-- issync:v1 -->\nMore content'

      expect(hasIssyncMarker(body)).toBe(false)
    })
  })

  describe('removeMarker', () => {
    test('removes marker from the beginning', () => {
      const body = '<!-- issync:v1 -->\nHello World'
      const result = removeMarker(body)

      expect(result).toBe('Hello World')
    })

    test('handles multiline content', () => {
      const content = 'Line 1\nLine 2\nLine 3'
      const body = `<!-- issync:v1 -->\n${content}`
      const result = removeMarker(body)

      expect(result).toBe(content)
    })

    test('returns content as-is when no marker is present', () => {
      const body = 'Regular comment content'
      const result = removeMarker(body)

      expect(result).toBe(body)
    })
  })

  describe('removeMarker idempotency', () => {
    test('removeMarker(removeMarker(x)) === removeMarker(x) for various inputs', () => {
      const testCases = [
        'Content only',
        '<!-- issync:v1 -->\nContent',
        '',
        'Line 1\nLine 2\nLine 3',
      ]

      for (const body of testCases) {
        const once = removeMarker(body)
        const twice = removeMarker(once)
        expect(twice).toBe(once)
      }
    })
  })

  describe('removeMarker edge cases', () => {
    test('handles marker-only content (no content after marker)', () => {
      const body = '<!-- issync:v1 -->\n'
      const result = removeMarker(body)

      // Should return empty string
      expect(result).toBe('')
    })

    test('handles marker with only whitespace content', () => {
      const body = '<!-- issync:v1 -->\n   \n  \n'
      const result = removeMarker(body)

      // Should preserve whitespace (no trim for new format)
      expect(result).toBe('   \n  \n')
    })

    test('preserves trailing newlines in new format', () => {
      const body = '<!-- issync:v1 -->\nContent with trailing newlines\n\n'
      const result = removeMarker(body)

      // Should preserve original formatting
      expect(result).toBe('Content with trailing newlines\n\n')
    })

    test('handles empty body', () => {
      const body = ''
      const result = removeMarker(body)

      expect(result).toBe('')
    })
  })

  describe('hasIssyncMarker edge cases', () => {
    test('returns false for empty string', () => {
      expect(hasIssyncMarker('')).toBe(false)
    })

    test('rejects marker with leading whitespace', () => {
      const body = '  <!-- issync:v1 -->\nContent'

      expect(hasIssyncMarker(body)).toBe(false)
    })

    test('rejects marker with trailing content on same line', () => {
      const body = '<!-- issync:v1 --> extra text\nContent'

      expect(hasIssyncMarker(body)).toBe(false)
    })
  })
})

describe('GitHubClient.findIssyncComment', () => {
  const VALID_TOKEN = `ghp_${'a'.repeat(36)}`

  test('returns comment when comment_id is provided and has marker', async () => {
    const client = new GitHubClient(VALID_TOKEN)
    const mockComment = {
      id: 123,
      body: '<!-- issync:v1 -->\nContent',
      updated_at: '2025-01-01T00:00:00Z',
    }

    const getCommentSpy = spyOn(client, 'getComment').mockResolvedValue(mockComment)

    const result = await client.findIssyncComment('owner', 'repo', 1, 123)

    expect(result).toEqual(mockComment)
    expect(getCommentSpy).toHaveBeenCalledWith('owner', 'repo', 123)

    getCommentSpy.mockRestore()
  })

  test('searches all comments when comment_id has no markers', async () => {
    const client = new GitHubClient(VALID_TOKEN)
    const commentWithoutMarkers = {
      id: 123,
      body: 'Regular comment',
      updated_at: '2025-01-01T00:00:00Z',
    }
    const commentWithMarkers = {
      id: 456,
      body: '<!-- issync:v1 -->\nContent',
      updated_at: '2025-01-01T00:00:00Z',
    }

    const getCommentSpy = spyOn(client, 'getComment').mockResolvedValue(commentWithoutMarkers)
    const listCommentsSpy = spyOn(client, 'listComments').mockResolvedValue([
      commentWithoutMarkers,
      commentWithMarkers,
    ])

    const result = await client.findIssyncComment('owner', 'repo', 1, 123)

    expect(result).toEqual(commentWithMarkers)
    expect(listCommentsSpy).toHaveBeenCalledWith('owner', 'repo', 1)

    getCommentSpy.mockRestore()
    listCommentsSpy.mockRestore()
  })

  test('searches all comments when no comment_id is provided', async () => {
    const client = new GitHubClient(VALID_TOKEN)
    const commentWithMarkers = {
      id: 456,
      body: '<!-- issync:v1 -->\nContent',
      updated_at: '2025-01-01T00:00:00Z',
    }

    const listCommentsSpy = spyOn(client, 'listComments').mockResolvedValue([
      { id: 123, body: 'Regular comment', updated_at: '2025-01-01T00:00:00Z' },
      commentWithMarkers,
    ])

    const result = await client.findIssyncComment('owner', 'repo', 1)

    expect(result).toEqual(commentWithMarkers)
    expect(listCommentsSpy).toHaveBeenCalledWith('owner', 'repo', 1)

    listCommentsSpy.mockRestore()
  })

  test('returns null when no issync comment is found', async () => {
    const client = new GitHubClient(VALID_TOKEN)

    const listCommentsSpy = spyOn(client, 'listComments').mockResolvedValue([
      { id: 123, body: 'Regular comment 1', updated_at: '2025-01-01T00:00:00Z' },
      { id: 456, body: 'Regular comment 2', updated_at: '2025-01-01T00:00:00Z' },
    ])

    const result = await client.findIssyncComment('owner', 'repo', 1)

    expect(result).toBeNull()

    listCommentsSpy.mockRestore()
  })

  test('falls back to search when comment_id does not exist', async () => {
    const client = new GitHubClient(VALID_TOKEN)
    const commentWithMarkers = {
      id: 456,
      body: '<!-- issync:v1 -->\nContent',
      updated_at: '2025-01-01T00:00:00Z',
    }

    // Simulate 404 error from Octokit
    const notFoundError = Object.assign(new Error('Not Found'), { status: 404 })
    const getCommentSpy = spyOn(client, 'getComment').mockRejectedValue(notFoundError)
    const listCommentsSpy = spyOn(client, 'listComments').mockResolvedValue([commentWithMarkers])

    const result = await client.findIssyncComment('owner', 'repo', 1, 999)

    expect(result).toEqual(commentWithMarkers)
    expect(listCommentsSpy).toHaveBeenCalledWith('owner', 'repo', 1)

    getCommentSpy.mockRestore()
    listCommentsSpy.mockRestore()
  })
})

describe('backward compatibility with legacy markers', () => {
  describe('hasIssyncMarker with legacy format', () => {
    test('returns true for legacy start/end format', () => {
      const body = '<!-- issync:v1:start -->\nContent\n<!-- issync:v1:end -->'

      expect(hasIssyncMarker(body)).toBe(true)
    })

    test('returns false when only start marker is present', () => {
      const body = '<!-- issync:v1:start -->\nContent'

      expect(hasIssyncMarker(body)).toBe(false)
    })

    test('returns false when only end marker is present', () => {
      const body = 'Content\n<!-- issync:v1:end -->'

      expect(hasIssyncMarker(body)).toBe(false)
    })

    test('returns true even when markers are in wrong order', () => {
      const body = '<!-- issync:v1:end -->Content<!-- issync:v1:start -->'

      // hasIssyncMarker only checks for presence, removeMarker handles order
      expect(hasIssyncMarker(body)).toBe(true)
    })
  })

  describe('removeMarker with legacy format', () => {
    test('extracts content from legacy start/end format', () => {
      const body = '<!-- issync:v1:start -->\nHello World\n<!-- issync:v1:end -->'
      const result = removeMarker(body)

      expect(result).toBe('Hello World')
    })

    test('handles multiline content in legacy format', () => {
      const content = 'Line 1\nLine 2\nLine 3'
      const body = `<!-- issync:v1:start -->\n${content}\n<!-- issync:v1:end -->`
      const result = removeMarker(body)

      expect(result).toBe(content)
    })

    test('returns original when only start marker is present', () => {
      const body = '<!-- issync:v1:start -->\nContent'
      const result = removeMarker(body)

      expect(result).toBe(body)
    })

    test('returns original when markers are in wrong order', () => {
      const body = '<!-- issync:v1:end -->Content<!-- issync:v1:start -->'
      const result = removeMarker(body)

      expect(result).toBe(body)
    })

    test('extracts content from first occurrence when multiple markers exist', () => {
      const body =
        '<!-- issync:v1:start -->\nContent1\n<!-- issync:v1:end --><!-- issync:v1:start -->Content2<!-- issync:v1:end -->'
      const result = removeMarker(body)

      expect(result).toBe('Content1')
    })

    test('handles legacy format without surrounding newlines', () => {
      const body = '<!-- issync:v1:start -->Hello World<!-- issync:v1:end -->'
      const result = removeMarker(body)

      expect(result).toBe('Hello World')
    })
  })

  describe('findIssyncComment with legacy markers', () => {
    const VALID_TOKEN = `ghp_${'a'.repeat(36)}`

    test('finds comment with legacy markers when searching', async () => {
      const client = new GitHubClient(VALID_TOKEN)
      const legacyComment = {
        id: 456,
        body: '<!-- issync:v1:start -->\nContent\n<!-- issync:v1:end -->',
        updated_at: '2025-01-01T00:00:00Z',
      }

      const listCommentsSpy = spyOn(client, 'listComments').mockResolvedValue([
        { id: 123, body: 'Regular comment', updated_at: '2025-01-01T00:00:00Z' },
        legacyComment,
      ])

      const result = await client.findIssyncComment('owner', 'repo', 1)

      expect(result).toEqual(legacyComment)

      listCommentsSpy.mockRestore()
    })

    test('finds comment with legacy markers by comment_id', async () => {
      const client = new GitHubClient(VALID_TOKEN)
      const legacyComment = {
        id: 123,
        body: '<!-- issync:v1:start -->\nContent\n<!-- issync:v1:end -->',
        updated_at: '2025-01-01T00:00:00Z',
      }

      const getCommentSpy = spyOn(client, 'getComment').mockResolvedValue(legacyComment)

      const result = await client.findIssyncComment('owner', 'repo', 1, 123)

      expect(result).toEqual(legacyComment)
      expect(getCommentSpy).toHaveBeenCalledWith('owner', 'repo', 123)

      getCommentSpy.mockRestore()
    })
  })
})
