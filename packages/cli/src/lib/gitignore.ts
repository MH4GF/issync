import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Check if .issync is present in the project root .gitignore file
 * @returns true if .gitignore exists and contains .issync entry, false otherwise
 */
export function hasIssyncInGitignore(): boolean {
  const gitignorePath = join(process.cwd(), '.gitignore')

  // Return false if .gitignore doesn't exist
  if (!existsSync(gitignorePath)) {
    return false
  }

  try {
    const content = readFileSync(gitignorePath, 'utf-8')
    const lines = content.split('\n')

    // Check each line for .issync entry
    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue
      }

      // Check if line contains .issync
      if (trimmedLine.includes('.issync')) {
        return true
      }
    }

    return false
  } catch {
    // If file can't be read, return false
    return false
  }
}
