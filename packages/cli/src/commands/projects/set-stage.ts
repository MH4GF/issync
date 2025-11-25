import { GitHubProjectsClient } from '../../lib/github-projects.js'

export interface SetStageOptions {
  issueUrl: string
  stage: string
  token?: string
}

export async function setStage(options: SetStageOptions): Promise<void> {
  try {
    const client = new GitHubProjectsClient(options.token)
    await client.updateProjectField(options.issueUrl, 'Stage', options.stage)
    console.log(`✅ Stage set to "${options.stage}"`)
  } catch (error) {
    // Log warning but exit with code 0 to not interrupt plugin commands
    console.error(
      `⚠️  GitHub Projects update failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
