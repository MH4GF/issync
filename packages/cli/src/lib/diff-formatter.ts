import chalk from 'chalk'
import * as Diff from 'diff'

export interface DiffOptions {
  localLabel?: string
  remoteLabel?: string
  useColor?: boolean
}

/**
 * Generate and format a unified diff between local and remote content
 */
export function formatDiff(
  localContent: string,
  remoteContent: string,
  options: DiffOptions = {},
): string {
  const { localLabel = 'local', remoteLabel = 'remote', useColor = true } = options

  // Generate unified diff
  const patch = Diff.createPatch(localLabel, remoteContent, localContent, remoteLabel, localLabel)

  if (!useColor) {
    return patch
  }

  // Apply colors to diff output
  const lines = patch.split('\n')
  const coloredLines = lines.map((line) => {
    if (line.startsWith('+++') || line.startsWith('---')) {
      // File headers - use bold
      return chalk.bold(line)
    }
    if (line.startsWith('+')) {
      // Added lines - green
      return chalk.green(line)
    }
    if (line.startsWith('-')) {
      // Removed lines - red
      return chalk.red(line)
    }
    if (line.startsWith('@@')) {
      // Hunk headers - cyan
      return chalk.cyan(line)
    }
    // Context lines - no color
    return line
  })

  return coloredLines.join('\n')
}

/**
 * Check if there are any differences between local and remote content
 */
export function hasDifferences(localContent: string, remoteContent: string): boolean {
  return localContent !== remoteContent
}
