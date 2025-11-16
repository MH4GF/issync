import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SyncSelector } from '../lib/config.js'
import { loadConfig, selectSync } from '../lib/config.js'
import { formatDiff, hasDifferences } from '../lib/diff-formatter.js'
import { FileNotFoundError } from '../lib/errors.js'
import { createGitHubClient, parseIssueUrl, removeMarker } from '../lib/github.js'
import { resolveFilePath } from '../lib/path.js'
import type { SelectorOptions } from '../types/index.js'

export interface DiffOptions extends SelectorOptions {
  color?: boolean
}

export async function diff(options: DiffOptions = {}): Promise<void> {
  const { cwd, token, file, issue, color = true } = options
  const baseDir = cwd ?? process.cwd()

  // Load config
  const state = loadConfig(cwd)

  // Select sync target
  const selector: SyncSelector = {
    file,
    issueUrl: issue,
  }
  const { sync, localFile } = selectSync(state, selector, baseDir)

  // Validate and read local file
  const basePath = path.resolve(baseDir)
  const resolvedPath = resolveFilePath(basePath, sync.local_file)

  if (!existsSync(resolvedPath)) {
    throw new FileNotFoundError(resolvedPath)
  }

  const localContent = await readFile(resolvedPath, 'utf-8')
  const localContentWithoutMarker = removeMarker(localContent)

  // Fetch remote content
  const issueInfo = parseIssueUrl(sync.issue_url)
  const client = createGitHubClient(token)

  let remoteContent = ''
  if (sync.comment_id) {
    const comment = await client.getComment(issueInfo.owner, issueInfo.repo, sync.comment_id)
    remoteContent = removeMarker(comment.body)
  }

  // Check if there are differences
  if (!hasDifferences(localContentWithoutMarker, remoteContent)) {
    console.log('No differences found')
    return
  }

  // Generate and display diff
  const filename = path.basename(localFile)
  const diffOutput = formatDiff(localContentWithoutMarker, remoteContent, {
    localLabel: `a/${filename}`,
    remoteLabel: 'b/remote',
    useColor: color,
  })

  console.log(diffOutput)
}
