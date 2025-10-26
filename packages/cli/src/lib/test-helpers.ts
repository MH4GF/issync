import { expect, mock } from 'bun:test'
import type { GitHubClient } from './github.js'

/**
 * Creates a mock GitHubClient with default implementations
 * All methods reject by default to catch unintended calls
 */
export function createMockGitHubClient(overrides: Partial<GitHubClient> = {}): GitHubClient {
  const defaultMethods = {
    findIssyncComment: mock(() => Promise.resolve(null)),
    getComment: mock(() => Promise.reject(new Error('getComment not mocked'))),
    createComment: mock(() => Promise.reject(new Error('createComment not mocked'))),
    updateComment: mock(() => Promise.reject(new Error('updateComment not mocked'))),
    listComments: mock(() => Promise.reject(new Error('listComments not mocked'))),
    parseIssueUrl: mock(() => ({ owner: '', repo: '', issue_number: 0 })),
  }

  return {
    ...defaultMethods,
    ...overrides,
  } as GitHubClient
}

/**
 * Asserts the content of a specific mock call
 * Useful for testing that mock functions were called with expected arguments
 */
export function expectNthCallContent(
  mockFn: ReturnType<typeof mock>,
  callIndex: number,
  expectedContent: string,
  argIndex = 3,
) {
  const call = mockFn.mock.calls[callIndex]
  if (!call) {
    throw new Error(`Expected call at index ${callIndex} but found none`)
  }
  expect(call[argIndex]).toBe(expectedContent)
}
