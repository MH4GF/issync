import { graphql } from '@octokit/graphql'
import {
  FieldNotFoundError,
  GitHubProjectsNotConfiguredError,
  GitHubTokenMissingError,
  IssueNotInProjectError,
  OptionNotFoundError,
  ProjectNotFoundError,
} from './errors.js'
import { parseIssueUrl } from './github.js'

interface ProjectInfo {
  projectId: string
  fields: FieldInfo[]
}

interface FieldInfo {
  id: string
  name: string
  options: OptionInfo[]
}

interface OptionInfo {
  id: string
  name: string
}

interface GraphQLResponse {
  user?: {
    projectV2?: {
      id: string
      fields: {
        nodes: Array<{
          id: string
          name: string
          options?: Array<{
            id: string
            name: string
          }>
        }>
      }
    }
  }
  organization?: {
    projectV2?: {
      id: string
      fields: {
        nodes: Array<{
          id: string
          name: string
          options?: Array<{
            id: string
            name: string
          }>
        }>
      }
    }
  }
  node?: {
    id: string
    projectItems?: {
      nodes: Array<{
        id: string
        project: {
          id: string
        }
      }>
    }
  }
}

interface ProjectV2ItemsResponse {
  items: {
    nodes: Array<{
      content?: {
        number?: number
      }
      fieldValues: {
        nodes: Array<{
          __typename?: string
          name?: string
          field?: {
            name?: string
          }
        }>
      }
    }>
  }
}

interface GetIssuesByStatusResponse {
  user?: { projectV2?: ProjectV2ItemsResponse }
  organization?: { projectV2?: ProjectV2ItemsResponse }
}

export interface IssueWithDetails {
  number: number
  status: string | null
  stage: string | null
}

type FieldValueNode = {
  __typename?: string
  name?: string
  field?: { name?: string }
}

function extractFieldValues(nodes: FieldValueNode[]): {
  status: string | null
  stage: string | null
} {
  let status: string | null = null
  let stage: string | null = null

  for (const node of nodes) {
    if (node.__typename !== 'ProjectV2ItemFieldSingleSelectValue') continue
    const fieldName = node.field?.name
    if (fieldName === 'Status') status = node.name ?? null
    else if (fieldName === 'Stage') stage = node.name ?? null
  }

  return { status, stage }
}

export class GitHubProjectsClient {
  private static readonly MAX_FIELDS_TO_FETCH = 20
  private static readonly MAX_PROJECT_ITEMS_TO_FETCH = 10
  private static readonly MAX_ITEMS_TO_FETCH = 100
  private static readonly MAX_FIELD_VALUES_TO_FETCH = 10

  private graphqlWithAuth: typeof graphql
  private projectNumber: number
  private projectOwner: string
  private cachedProjectInfo: ProjectInfo | null = null
  private cacheTimestamp: number | null = null
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  constructor(token?: string, graphqlFn?: typeof graphql) {
    const authToken = token ?? process.env.ISSYNC_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN
    if (!authToken) {
      throw new GitHubTokenMissingError()
    }

    this.graphqlWithAuth = (graphqlFn ?? graphql).defaults({
      headers: {
        authorization: `token ${authToken}`,
      },
    })

    // Check required environment variables
    const missingVars: string[] = []
    if (!process.env.ISSYNC_GITHUB_PROJECTS_NUMBER) {
      missingVars.push('ISSYNC_GITHUB_PROJECTS_NUMBER')
    }
    if (!process.env.ISSYNC_GITHUB_PROJECTS_OWNER) {
      missingVars.push('ISSYNC_GITHUB_PROJECTS_OWNER')
    }

    if (missingVars.length > 0) {
      throw new GitHubProjectsNotConfiguredError(missingVars)
    }

    // TypeScript narrowing: after the check above, these are guaranteed to be strings
    const projectNumber = process.env.ISSYNC_GITHUB_PROJECTS_NUMBER
    const projectOwner = process.env.ISSYNC_GITHUB_PROJECTS_OWNER
    // biome-ignore lint/style/noNonNullAssertion: Validated above
    this.projectNumber = Number.parseInt(projectNumber!, 10)
    // biome-ignore lint/style/noNonNullAssertion: Validated above
    this.projectOwner = projectOwner!
  }

  async getProjectInfo(): Promise<ProjectInfo> {
    // Return cached result if still valid
    const now = Date.now()
    if (
      this.cachedProjectInfo &&
      this.cacheTimestamp &&
      now - this.cacheTimestamp < this.CACHE_TTL_MS
    ) {
      return this.cachedProjectInfo
    }

    // Try user first, then organization
    let response: GraphQLResponse

    try {
      response = await this.graphqlWithAuth<GraphQLResponse>({
        query: `
          query($owner: String!, $projectNumber: Int!) {
            user(login: $owner) {
              projectV2(number: $projectNumber) {
                id
                fields(first: ${GitHubProjectsClient.MAX_FIELDS_TO_FETCH}) {
                  nodes {
                    ... on ProjectV2SingleSelectField {
                      id
                      name
                      options {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        owner: this.projectOwner,
        projectNumber: this.projectNumber,
      })
    } catch {
      // User query failed, try organization (silent fallback - expected behavior)
      response = await this.graphqlWithAuth<GraphQLResponse>({
        query: `
          query($owner: String!, $projectNumber: Int!) {
            organization(login: $owner) {
              projectV2(number: $projectNumber) {
                id
                fields(first: ${GitHubProjectsClient.MAX_FIELDS_TO_FETCH}) {
                  nodes {
                    ... on ProjectV2SingleSelectField {
                      id
                      name
                      options {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        owner: this.projectOwner,
        projectNumber: this.projectNumber,
      })
    }

    const projectV2 = response.user?.projectV2 ?? response.organization?.projectV2

    if (!projectV2) {
      throw new ProjectNotFoundError(this.projectOwner, this.projectNumber)
    }

    const projectInfo = {
      projectId: projectV2.id,
      fields: projectV2.fields.nodes
        .filter((node) => node.options !== undefined)
        .map((node) => ({
          id: node.id,
          name: node.name,
          options:
            node.options?.map((opt) => ({
              id: opt.id,
              name: opt.name,
            })) ?? [],
        })),
    }

    // Cache the result
    this.cachedProjectInfo = projectInfo
    this.cacheTimestamp = now

    return projectInfo
  }

  async getFieldId(fieldName: string): Promise<string> {
    const projectInfo = await this.getProjectInfo()
    const field = projectInfo.fields.find((f) => f.name === fieldName)

    if (!field) {
      throw new FieldNotFoundError(fieldName, projectInfo.projectId)
    }

    return field.id
  }

  async getOptionId(fieldName: string, optionName: string): Promise<string> {
    const projectInfo = await this.getProjectInfo()
    const field = projectInfo.fields.find((f) => f.name === fieldName)

    if (!field) {
      throw new FieldNotFoundError(fieldName, projectInfo.projectId)
    }

    const option = field.options.find((opt) => opt.name === optionName)

    if (!option) {
      throw new OptionNotFoundError(optionName, fieldName)
    }

    return option.id
  }

  async getIssueProjectItemId(issueUrl: string): Promise<string> {
    const { owner, repo, issue_number } = parseIssueUrl(issueUrl)
    const projectInfo = await this.getProjectInfo()

    // Get issue node ID
    const issueResponse = await this.graphqlWithAuth<{
      repository: {
        issue: {
          id: string
        }
      }
    }>({
      query: `
        query($owner: String!, $repo: String!, $issueNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
              id
            }
          }
        }
      `,
      owner,
      repo,
      issueNumber: issue_number,
    })

    const issueNodeId = issueResponse.repository.issue.id

    // Get project item ID for this issue
    const response = await this.graphqlWithAuth<GraphQLResponse>({
      query: `
        query($nodeId: ID!) {
          node(id: $nodeId) {
            ... on Issue {
              id
              projectItems(first: ${GitHubProjectsClient.MAX_PROJECT_ITEMS_TO_FETCH}) {
                nodes {
                  id
                  project {
                    id
                  }
                }
              }
            }
          }
        }
      `,
      nodeId: issueNodeId,
    })

    const projectItem = response.node?.projectItems?.nodes.find(
      (item) => (item as { project: { id: string } }).project.id === projectInfo.projectId,
    )

    if (!projectItem) {
      throw new IssueNotInProjectError(issueUrl)
    }

    return projectItem.id
  }

  async updateProjectField(issueUrl: string, fieldName: string, optionName: string): Promise<void> {
    const projectInfo = await this.getProjectInfo()
    const itemId = await this.getIssueProjectItemId(issueUrl)
    const fieldId = await this.getFieldId(fieldName)
    const optionId = await this.getOptionId(fieldName, optionName)

    await this.graphqlWithAuth({
      query: `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $projectId
              itemId: $itemId
              fieldId: $fieldId
              value: $value
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `,
      projectId: projectInfo.projectId,
      itemId,
      fieldId,
      value: {
        singleSelectOptionId: optionId,
      },
    })
  }

  async clearProjectField(issueUrl: string, fieldName: string): Promise<void> {
    const projectInfo = await this.getProjectInfo()
    const itemId = await this.getIssueProjectItemId(issueUrl)
    const fieldId = await this.getFieldId(fieldName)

    await this.graphqlWithAuth({
      query: `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
          clearProjectV2ItemFieldValue(
            input: {
              projectId: $projectId
              itemId: $itemId
              fieldId: $fieldId
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `,
      projectId: projectInfo.projectId,
      itemId,
      fieldId,
    })
  }

  async getIssuesWithDetails(statusValues: string[]): Promise<IssueWithDetails[]> {
    const query = (entityType: 'user' | 'organization') => `
      query($owner: String!, $projectNumber: Int!) {
        ${entityType}(login: $owner) {
          projectV2(number: $projectNumber) {
            items(first: ${GitHubProjectsClient.MAX_ITEMS_TO_FETCH}) {
              nodes {
                content {
                  ... on Issue {
                    number
                  }
                }
                fieldValues(first: ${GitHubProjectsClient.MAX_FIELD_VALUES_TO_FETCH}) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    const tryQuery = async (entityType: 'user' | 'organization') => {
      const response = await this.graphqlWithAuth<GetIssuesByStatusResponse>({
        query: query(entityType),
        owner: this.projectOwner,
        projectNumber: this.projectNumber,
      })

      const projectV2 = response[entityType]?.projectV2
      if (!projectV2) {
        throw new Error(`${entityType} has no projectV2`)
      }

      return projectV2.items.nodes
        .map((item) => {
          const number = item.content?.number
          if (number === undefined) return null
          const { status, stage } = extractFieldValues(item.fieldValues.nodes)
          return { number, status, stage }
        })
        .filter((item): item is IssueWithDetails => item !== null)
        .filter((item) => statusValues.length === 0 || statusValues.includes(item.status ?? ''))
    }

    try {
      return await tryQuery('user')
    } catch {
      try {
        return await tryQuery('organization')
      } catch {
        throw new ProjectNotFoundError(this.projectOwner, this.projectNumber)
      }
    }
  }

  async getIssuesByStatus(statusValue: string): Promise<number[]> {
    const query = (entityType: 'user' | 'organization') => `
      query($owner: String!, $projectNumber: Int!) {
        ${entityType}(login: $owner) {
          projectV2(number: $projectNumber) {
            items(first: ${GitHubProjectsClient.MAX_ITEMS_TO_FETCH}) {
              nodes {
                content {
                  ... on Issue {
                    number
                  }
                }
                fieldValues(first: ${GitHubProjectsClient.MAX_FIELD_VALUES_TO_FETCH}) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    const tryQuery = async (entityType: 'user' | 'organization') => {
      const response = await this.graphqlWithAuth<GetIssuesByStatusResponse>({
        query: query(entityType),
        owner: this.projectOwner,
        projectNumber: this.projectNumber,
      })

      const projectV2 = response[entityType]?.projectV2
      if (!projectV2) {
        throw new Error(`${entityType} has no projectV2`)
      }

      return projectV2.items.nodes
        .filter((item) =>
          item.fieldValues.nodes.some(
            (fieldValue) =>
              fieldValue.__typename === 'ProjectV2ItemFieldSingleSelectValue' &&
              fieldValue.field?.name === 'Status' &&
              fieldValue.name === statusValue,
          ),
        )
        .map((item) => item.content?.number)
        .filter((n): n is number => n !== undefined)
    }

    try {
      return await tryQuery('user')
    } catch {
      // User query failed, try organization (silent fallback - expected behavior)
      try {
        return await tryQuery('organization')
      } catch {
        throw new ProjectNotFoundError(this.projectOwner, this.projectNumber)
      }
    }
  }
}
