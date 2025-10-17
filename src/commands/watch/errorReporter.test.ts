import { describe, expect, mock, test } from 'bun:test'
import type { IssyncSync } from '../../types/index.js'
import {
  formatError,
  reportPreparationFailures,
  reportSessionStartupFailures,
} from './errorReporter.js'

describe('formatError', () => {
  test('should format Error instance to message string', () => {
    const error = new Error('Something went wrong')
    expect(formatError(error)).toBe('Something went wrong')
  })

  test('should return string directly', () => {
    expect(formatError('Error message')).toBe('Error message')
  })

  test('should format object with message property', () => {
    const error = { message: 'Custom error object' }
    expect(formatError(error)).toBe('Custom error object')
  })

  test('should convert other types to string', () => {
    expect(formatError(42)).toBe('42')
    expect(formatError(null)).toBe('null')
    expect(formatError(undefined)).toBe('undefined')
  })

  test('should handle nested objects', () => {
    const error = { nested: { message: 'nested error' } }
    expect(formatError(error)).toBe('[object Object]')
  })
})

describe('reportPreparationFailures', () => {
  test('should not log anything when failures array is empty', () => {
    const consoleErrorSpy = mock(() => {})
    console.error = consoleErrorSpy

    reportPreparationFailures([])

    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  test('should log failure details when failures exist', () => {
    const mockSync: IssyncSync = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: '.issync/plan.md',
      last_synced_at: '2025-01-01T00:00:00Z',
      last_synced_hash: 'abc123',
      poll_interval: 30,
    }

    const failures = [
      { sync: mockSync, error: 'Path traversal detected' },
      {
        sync: { ...mockSync, issue_url: 'https://github.com/owner/repo/issues/2' },
        error: 'File not found',
      },
    ]

    const consoleErrorSpy = mock(() => {})
    console.error = consoleErrorSpy

    reportPreparationFailures(failures)

    expect(consoleErrorSpy).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to prepare 2 sync(s):')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '  https://github.com/owner/repo/issues/1: Path traversal detected',
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '  https://github.com/owner/repo/issues/2: File not found',
    )
  })
})

describe('reportSessionStartupFailures', () => {
  test('should not log anything when failures array is empty', () => {
    const consoleErrorSpy = mock(() => {})
    console.error = consoleErrorSpy

    reportSessionStartupFailures([])

    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  test('should log failure details with error messages', () => {
    const mockSync: IssyncSync = {
      issue_url: 'https://github.com/owner/repo/issues/1',
      comment_id: 123,
      local_file: '.issync/plan.md',
      last_synced_at: '2025-01-01T00:00:00Z',
      last_synced_hash: 'abc123',
      poll_interval: 30,
    }

    const failures = [
      {
        target: { sync: mockSync, resolvedPath: '/project/.issync/plan.md' },
        error: new Error('Network error'),
      },
      {
        target: {
          sync: { ...mockSync, issue_url: 'https://github.com/owner/repo/issues/2' },
          resolvedPath: '/project/.issync/plan2.md',
        },
        error: 'String error',
      },
    ]

    const consoleErrorSpy = mock(() => {})
    console.error = consoleErrorSpy

    reportSessionStartupFailures(failures)

    expect(consoleErrorSpy).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalledWith('\n2 session(s) failed to start')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '  https://github.com/owner/repo/issues/1: Network error',
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '  https://github.com/owner/repo/issues/2: String error',
    )
  })
})
