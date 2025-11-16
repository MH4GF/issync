import { describe, expect, test } from 'bun:test'
import { formatDiff, hasDifferences } from './diff-formatter.js'

describe('diff-formatter', () => {
  describe('hasDifferences', () => {
    test('returns false when contents are identical', () => {
      const content = '# Test\n\nSome content here.'
      expect(hasDifferences(content, content)).toBe(false)
    })

    test('returns true when contents differ', () => {
      const local = '# Test\n\nLocal content.'
      const remote = '# Test\n\nRemote content.'
      expect(hasDifferences(local, remote)).toBe(true)
    })

    test('returns true for whitespace differences', () => {
      const local = '# Test\n\nContent'
      const remote = '# Test\n\nContent '
      expect(hasDifferences(local, remote)).toBe(true)
    })
  })

  describe('formatDiff', () => {
    test('generates unified diff format', () => {
      const local = '# Test\n\nLocal line.'
      const remote = '# Test\n\nRemote line.'

      const diff = formatDiff(local, remote, { useColor: false })

      expect(diff).toContain('--- a/local')
      expect(diff).toContain('+++ b/remote')
      expect(diff).toContain('-Remote line.')
      expect(diff).toContain('+Local line.')
    })

    test('uses custom labels', () => {
      const local = '# Test\n\nLocal.'
      const remote = '# Test\n\nRemote.'

      const diff = formatDiff(local, remote, {
        localLabel: 'a/custom.md',
        remoteLabel: 'b/origin',
        useColor: false,
      })

      expect(diff).toContain('--- a/custom.md')
      expect(diff).toContain('+++ b/origin')
    })

    test('handles additions', () => {
      const local = '# Test\n\nLine 1\nLine 2\nLine 3'
      const remote = '# Test\n\nLine 1\nLine 3'

      const diff = formatDiff(local, remote, { useColor: false })

      expect(diff).toContain('+Line 2')
    })

    test('handles deletions', () => {
      const local = '# Test\n\nLine 1\nLine 3'
      const remote = '# Test\n\nLine 1\nLine 2\nLine 3'

      const diff = formatDiff(local, remote, { useColor: false })

      expect(diff).toContain('-Line 2')
    })

    test('handles empty remote', () => {
      const local = '# Test\n\nContent'
      const remote = ''

      const diff = formatDiff(local, remote, { useColor: false })

      expect(diff).toContain('+# Test')
      expect(diff).toContain('+Content')
    })

    test('handles empty local', () => {
      const local = ''
      const remote = '# Test\n\nContent'

      const diff = formatDiff(local, remote, { useColor: false })

      expect(diff).toContain('-# Test')
      expect(diff).toContain('-Content')
    })

    test('includes hunk headers', () => {
      const local = '# Test\n\nLocal.'
      const remote = '# Test\n\nRemote.'

      const diff = formatDiff(local, remote, { useColor: false })

      // Hunk header should be present (format: @@ -line,count +line,count @@)
      expect(diff).toMatch(/@@.*@@/)
    })
  })
})
