import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Checks if `.issync` is already present in the project's .gitignore file.
 *
 * This function reads the .gitignore file from the project root and checks if any
 * non-comment line contains the string '.issync'. This flexible approach supports
 * various user notation styles (.issync/, .issync, /.issync/, .issync/*, etc.).
 *
 * @param cwd - The current working directory (defaults to process.cwd())
 * @returns true if .gitignore exists and contains '.issync' entry, false otherwise
 *
 * @example
 * // .gitignore contains ".issync/"
 * hasIssyncInGitignore() // => true
 *
 * @example
 * // .gitignore doesn't exist or doesn't contain .issync
 * hasIssyncInGitignore() // => false
 */
export function hasIssyncInGitignore(cwd = process.cwd()): boolean {
  const gitignorePath = path.join(cwd, '.gitignore')

  // If .gitignore doesn't exist, return false
  if (!existsSync(gitignorePath)) {
    return false
  }

  try {
    const content = readFileSync(gitignorePath, 'utf-8')
    const lines = content.split('\n')

    // Check if any non-comment line contains '.issync'
    for (const line of lines) {
      const trimmed = line.trim()
      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue
      }
      // Check if line contains '.issync'
      if (trimmed.includes('.issync')) {
        return true
      }
    }

    return false
  } catch (error) {
    // If we can't read the file, treat it as if it doesn't exist
    return false
  }
}
