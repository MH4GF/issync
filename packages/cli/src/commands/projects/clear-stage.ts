import { GitHubProjectsClient } from '../../lib/github-projects.js'

export interface ClearStageOptions {
  issueUrl: string
  token?: string
}

export async function clearStage(options: ClearStageOptions): Promise<void> {
  try {
    const client = new GitHubProjectsClient(options.token)
    await client.clearProjectField(options.issueUrl, 'Stage')
    console.log('✅ Stage cleared')
  } catch (error) {
    // Log warning but exit with code 0 to not interrupt plugin commands
    console.error(
      `⚠️  GitHub Projects update failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
