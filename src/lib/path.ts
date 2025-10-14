import path from 'node:path'
import { InvalidFilePathError } from './errors.js'

function _escapesBase(relativePath: string): boolean {
  const normalized = relativePath === '' ? '.' : path.normalize(relativePath)

  if (path.isAbsolute(normalized)) {
    return true
  }

  return normalized.split(path.sep).includes('..')
}

/**
 * Resolves a target path within a base directory, preventing path traversal attacks.
 * Allows directory names starting with ".." (like "..docs") but blocks "../parent" style traversal.
 *
 * @param basePath - The base directory path (absolute or relative, will be resolved)
 * @param targetPath - The target path to resolve (relative to base)
 * @param label - Label for error messages (defaults to targetPath)
 * @returns The resolved absolute path within the base directory
 * @throws InvalidFilePathError if path traversal is detected (e.g., "../etc/passwd" or "/etc/passwd")
 *
 * @example
 * // Valid: Directory name starting with ".."
 * resolvePathWithinBase('/base', '..docs/plan.md', 'local_file')
 * // => '/base/..docs/plan.md'
 *
 * @example
 * // Invalid: Path traversal attempt
 * resolvePathWithinBase('/base', '../etc/passwd', 'local_file')
 * // => throws InvalidFilePathError('local_file', 'path traversal detected')
 *
 * @example
 * // Invalid: Absolute path
 * resolvePathWithinBase('/base', '/etc/passwd', 'local_file')
 * // => throws InvalidFilePathError('local_file', 'path traversal detected')
 */
export function resolvePathWithinBase(
  basePath: string,
  targetPath: string,
  label = targetPath,
): string {
  const resolvedBase = path.resolve(basePath)
  const resolvedTarget = path.resolve(resolvedBase, targetPath)
  const relativePath = path.relative(resolvedBase, resolvedTarget)

  if (_escapesBase(relativePath)) {
    throw new InvalidFilePathError(label, 'path traversal detected')
  }

  return resolvedTarget
}
