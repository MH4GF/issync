import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { graphql } from '@octokit/graphql'
import {
  FieldNotFoundError,
  GitHubProjectsNotConfiguredError,
  GitHubTokenMissingError,
  OptionNotFoundError,
  ProjectNotFoundError,
} from './errors'
import { GitHubProjectsClient } from './github-projects'

describe('GitHubProjectsClient constructor', () => {
  const originalEnv = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    ISSYNC_GITHUB_TOKEN: process.env.ISSYNC_GITHUB_TOKEN,
    ISSYNC_GITHUB_PROJECTS_NUMBER: process.env.ISSYNC_GITHUB_PROJECTS_NUMBER,
    ISSYNC_GITHUB_PROJECTS_OWNER: process.env.ISSYNC_GITHUB_PROJECTS_OWNER,
  }

  beforeEach(() => {
    // Set required env vars for tests
    process.env.GITHUB_TOKEN = 'ghp_test_token_123456789012345678901234'
    process.env.ISSYNC_GITHUB_PROJECTS_NUMBER = '42'
    process.env.ISSYNC_GITHUB_PROJECTS_OWNER = 'test-owner'
  })

  afterEach(() => {
    // Restore original env vars
    process.env.GITHUB_TOKEN = originalEnv.GITHUB_TOKEN
    process.env.ISSYNC_GITHUB_TOKEN = originalEnv.ISSYNC_GITHUB_TOKEN
    process.env.ISSYNC_GITHUB_PROJECTS_NUMBER = originalEnv.ISSYNC_GITHUB_PROJECTS_NUMBER
    process.env.ISSYNC_GITHUB_PROJECTS_OWNER = originalEnv.ISSYNC_GITHUB_PROJECTS_OWNER
  })

  test('throws error when GITHUB_TOKEN is missing', () => {
    delete process.env.GITHUB_TOKEN
    delete process.env.ISSYNC_GITHUB_TOKEN

    expect(() => new GitHubProjectsClient()).toThrow(GitHubTokenMissingError)
  })

  test('throws error when ISSYNC_GITHUB_PROJECTS_NUMBER is missing', () => {
    delete process.env.ISSYNC_GITHUB_PROJECTS_NUMBER

    expect(() => new GitHubProjectsClient()).toThrow(GitHubProjectsNotConfiguredError)
  })

  test('throws error when ISSYNC_GITHUB_PROJECTS_OWNER is missing', () => {
    delete process.env.ISSYNC_GITHUB_PROJECTS_OWNER

    expect(() => new GitHubProjectsClient()).toThrow(GitHubProjectsNotConfiguredError)
  })

  test('accepts valid configuration', () => {
    expect(() => new GitHubProjectsClient()).not.toThrow()
  })

  test('prefers ISSYNC_GITHUB_TOKEN over GITHUB_TOKEN', () => {
    process.env.ISSYNC_GITHUB_TOKEN = 'ghp_issync_token_123456789012345678901'
    process.env.GITHUB_TOKEN = 'ghp_github_token_123456789012345678901'

    expect(() => new GitHubProjectsClient()).not.toThrow()
  })
})

describe('GitHubProjectsClient.getProjectInfo', () => {
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
    mock.restore()
  })

  test('returns project info for user project', async () => {
    const mockGraphql = mock(() =>
      Promise.resolve({
        user: {
          projectV2: {
            id: 'project-id-123',
            fields: {
              nodes: [
                {
                  id: 'field-id-1',
                  name: 'Stage',
                  options: [
                    { id: 'option-id-1', name: 'To Start' },
                    { id: 'option-id-2', name: 'In Progress' },
                  ],
                },
              ],
            },
          },
        },
      }),
    )

    const client = new GitHubProjectsClient()
    // @ts-expect-error - private field access for testing
    client.graphqlWithAuth = mockGraphql

    const result = await client.getProjectInfo()

    expect(result).toEqual({
      projectId: 'project-id-123',
      fields: [
        {
          id: 'field-id-1',
          name: 'Stage',
          options: [
            { id: 'option-id-1', name: 'To Start' },
            { id: 'option-id-2', name: 'In Progress' },
          ],
        },
      ],
    })
  })

  test('throws ProjectNotFoundError when project does not exist', async () => {
    const mockGraphql = mock(() =>
      Promise.resolve({
        user: {},
        organization: {},
      }),
    )

    const client = new GitHubProjectsClient()
    // @ts-expect-error - private field access for testing
    client.graphqlWithAuth = mockGraphql

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(client.getProjectInfo()).rejects.toThrow(ProjectNotFoundError)
  })
})

describe('GitHubProjectsClient.getFieldId', () => {
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
    mock.restore()
  })

  test('returns field ID when field exists', async () => {
    const mockGraphql = mock(() =>
      Promise.resolve({
        user: {
          projectV2: {
            id: 'project-id-123',
            fields: {
              nodes: [
                {
                  id: 'field-id-stage',
                  name: 'Stage',
                  options: [{ id: 'option-id-1', name: 'To Start' }],
                },
              ],
            },
          },
        },
      }),
    )

    const client = new GitHubProjectsClient()
    // @ts-expect-error - private field access for testing
    client.graphqlWithAuth = mockGraphql

    const result = await client.getFieldId('Stage')

    expect(result).toBe('field-id-stage')
  })

  test('throws FieldNotFoundError when field does not exist', async () => {
    const mockGraphql = mock(() =>
      Promise.resolve({
        user: {
          projectV2: {
            id: 'project-id-123',
            fields: {
              nodes: [],
            },
          },
        },
      }),
    )

    const client = new GitHubProjectsClient()
    // @ts-expect-error - private field access for testing
    client.graphqlWithAuth = mockGraphql

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(client.getFieldId('NonExistentField')).rejects.toThrow(FieldNotFoundError)
  })
})

describe('GitHubProjectsClient.getOptionId', () => {
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
    mock.restore()
  })

  test('returns option ID when option exists', async () => {
    const mockGraphql = mock(() =>
      Promise.resolve({
        user: {
          projectV2: {
            id: 'project-id-123',
            fields: {
              nodes: [
                {
                  id: 'field-id-stage',
                  name: 'Stage',
                  options: [
                    { id: 'option-id-to-start', name: 'To Start' },
                    { id: 'option-id-in-progress', name: 'In Progress' },
                  ],
                },
              ],
            },
          },
        },
      }),
    )

    const client = new GitHubProjectsClient()
    // @ts-expect-error - private field access for testing
    client.graphqlWithAuth = mockGraphql

    const result = await client.getOptionId('Stage', 'In Progress')

    expect(result).toBe('option-id-in-progress')
  })

  test('throws FieldNotFoundError when field does not exist', async () => {
    const mockGraphql = mock(() =>
      Promise.resolve({
        user: {
          projectV2: {
            id: 'project-id-123',
            fields: {
              nodes: [],
            },
          },
        },
      }),
    )

    const client = new GitHubProjectsClient()
    // @ts-expect-error - private field access for testing
    client.graphqlWithAuth = mockGraphql

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(client.getOptionId('NonExistentField', 'To Start')).rejects.toThrow(
      FieldNotFoundError,
    )
  })

  test('throws OptionNotFoundError when option does not exist', async () => {
    const mockGraphql = mock(() =>
      Promise.resolve({
        user: {
          projectV2: {
            id: 'project-id-123',
            fields: {
              nodes: [
                {
                  id: 'field-id-stage',
                  name: 'Stage',
                  options: [{ id: 'option-id-to-start', name: 'To Start' }],
                },
              ],
            },
          },
        },
      }),
    )

    const client = new GitHubProjectsClient()
    // @ts-expect-error - private field access for testing
    client.graphqlWithAuth = mockGraphql

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(client.getOptionId('Stage', 'NonExistentOption')).rejects.toThrow(
      OptionNotFoundError,
    )
  })
})

describe('GitHubProjectsClient.getIssuesByStatus', () => {
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
    mock.restore()
  })

  test('returns issue numbers with matching status', async () => {
    const mockGraphqlFn = mock().mockResolvedValueOnce({
      user: {
        projectV2: {
          items: {
            nodes: [
              {
                content: { number: 56 },
                fieldValues: {
                  nodes: [
                    {
                      __typename: 'ProjectV2ItemFieldSingleSelectValue',
                      name: 'retrospective',
                      field: { name: 'Status' },
                    },
                  ],
                },
              },
              {
                content: { number: 62 },
                fieldValues: {
                  nodes: [
                    {
                      __typename: 'ProjectV2ItemFieldSingleSelectValue',
                      name: 'retrospective',
                      field: { name: 'Status' },
                    },
                  ],
                },
              },
              {
                content: { number: 70 },
                fieldValues: {
                  nodes: [
                    {
                      __typename: 'ProjectV2ItemFieldSingleSelectValue',
                      name: 'done',
                      field: { name: 'Status' },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    })

    const mockGraphql = { defaults: () => mockGraphqlFn } as unknown as typeof graphql
    const client = new GitHubProjectsClient('ghp_test_token_123456789012345678901234', mockGraphql)

    const result = await client.getIssuesByStatus('retrospective')

    expect(result).toEqual([56, 62])
  })

  test('returns empty array when no issues match status', async () => {
    const mockGraphqlFn = mock().mockResolvedValueOnce({
      user: {
        projectV2: {
          items: {
            nodes: [
              {
                content: { number: 70 },
                fieldValues: {
                  nodes: [
                    {
                      __typename: 'ProjectV2ItemFieldSingleSelectValue',
                      name: 'done',
                      field: { name: 'Status' },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    })

    const mockGraphql = { defaults: () => mockGraphqlFn } as unknown as typeof graphql
    const client = new GitHubProjectsClient('ghp_test_token_123456789012345678901234', mockGraphql)

    const result = await client.getIssuesByStatus('retrospective')

    expect(result).toEqual([])
  })

  test('throws ProjectNotFoundError when both user and organization queries fail', async () => {
    const mockGraphqlFn = mock()
      .mockRejectedValueOnce(new Error('User query failed'))
      .mockRejectedValueOnce(new Error('Organization query failed'))

    const mockGraphql = { defaults: () => mockGraphqlFn } as unknown as typeof graphql
    const client = new GitHubProjectsClient('ghp_test_token_123456789012345678901234', mockGraphql)

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(client.getIssuesByStatus('retrospective')).rejects.toThrow(ProjectNotFoundError)
  })

  test('handles empty project (no items)', async () => {
    const mockGraphqlFn = mock().mockResolvedValueOnce({
      user: {
        projectV2: {
          items: {
            nodes: [],
          },
        },
      },
    })

    const mockGraphql = { defaults: () => mockGraphqlFn } as unknown as typeof graphql
    const client = new GitHubProjectsClient('ghp_test_token_123456789012345678901234', mockGraphql)

    const result = await client.getIssuesByStatus('retrospective')

    expect(result).toEqual([])
  })

  test('handles issues without fieldValues', async () => {
    const mockGraphqlFn = mock().mockResolvedValueOnce({
      user: {
        projectV2: {
          items: {
            nodes: [
              {
                content: { number: 56 },
                fieldValues: {
                  nodes: [],
                },
              },
            ],
          },
        },
      },
    })

    const mockGraphql = { defaults: () => mockGraphqlFn } as unknown as typeof graphql
    const client = new GitHubProjectsClient('ghp_test_token_123456789012345678901234', mockGraphql)

    const result = await client.getIssuesByStatus('retrospective')

    expect(result).toEqual([])
  })

  test('finds project in organization when user query fails', async () => {
    const mockGraphqlFn = mock()
      .mockRejectedValueOnce(new Error('User not found'))
      .mockResolvedValueOnce({
        organization: {
          projectV2: {
            items: {
              nodes: [
                {
                  content: { number: 78 },
                  fieldValues: {
                    nodes: [
                      {
                        __typename: 'ProjectV2ItemFieldSingleSelectValue',
                        name: 'retrospective',
                        field: { name: 'Status' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      })

    const mockGraphql = { defaults: () => mockGraphqlFn } as unknown as typeof graphql
    const client = new GitHubProjectsClient('ghp_test_token_123456789012345678901234', mockGraphql)

    const result = await client.getIssuesByStatus('retrospective')

    expect(result).toEqual([78])
  })

  test('throws ProjectNotFoundError when user succeeds but projectV2 is null and organization fails', async () => {
    const mockGraphqlFn = mock()
      .mockResolvedValueOnce({ user: { projectV2: null } })
      .mockRejectedValueOnce(new Error('Organization query failed'))

    const mockGraphql = { defaults: () => mockGraphqlFn } as unknown as typeof graphql
    const client = new GitHubProjectsClient('ghp_test_token_123456789012345678901234', mockGraphql)

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(client.getIssuesByStatus('retrospective')).rejects.toThrow(ProjectNotFoundError)
  })

  test('throws ProjectNotFoundError when both queries succeed but projectV2 is null', async () => {
    const mockGraphqlFn = mock()
      .mockResolvedValueOnce({ user: { projectV2: null } })
      .mockResolvedValueOnce({ organization: { projectV2: null } })

    const mockGraphql = { defaults: () => mockGraphqlFn } as unknown as typeof graphql
    const client = new GitHubProjectsClient('ghp_test_token_123456789012345678901234', mockGraphql)

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(client.getIssuesByStatus('retrospective')).rejects.toThrow(ProjectNotFoundError)
  })
})
