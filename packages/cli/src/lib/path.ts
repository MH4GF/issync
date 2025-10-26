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
 * @param basePath - The base directory (will be resolved to absolute)
 * @param targetPath - The target path (relative to base, or absolute if allowAbsolute=true)
 * @param label - Label for error messages
 * @param allowAbsolute - Allow absolute paths. Defaults to false.
 * @returns Resolved absolute path
 * @throws InvalidFilePathError if path traversal is detected or targets protected directory
 *
 * @example
 * // Relative paths only (allowAbsolute=false)
 * resolvePathWithinBase('/base', 'docs/plan.md')
 * // => '/base/docs/plan.md'
 *
 * @example
 * // Absolute paths allowed (allowAbsolute=true)
 * resolvePathWithinBase('/base', '/Users/user/docs/plan.md', 'local_file', true)
 * // => '/Users/user/docs/plan.md'
 */
export function resolvePathWithinBase(
  basePath: string,
  targetPath: string,
  label = targetPath,
  allowAbsolute = false,
): string {
  // If targetPath is already absolute and allowAbsolute is true, validate and use it
  if (allowAbsolute && path.isAbsolute(targetPath)) {
    const normalized = path.resolve(targetPath)

    // Prevent access to system-critical directories for security
    const dangerousPaths = ['/etc', '/sys', '/proc', '/dev', '/boot']
    const dangerousWindowsPaths = ['C:\\Windows\\System32', 'C:\\Windows\\SysWOW64']
    const allDangerousPaths = [...dangerousPaths, ...dangerousWindowsPaths]

    for (const dangerousPath of allDangerousPaths) {
      if (normalized.startsWith(dangerousPath)) {
        throw new InvalidFilePathError(label, 'absolute path targets protected system directory')
      }
    }

    return normalized
  }

  const resolvedBase = path.resolve(basePath)
  const resolvedTarget = path.resolve(resolvedBase, targetPath)
  const relativePath = path.relative(resolvedBase, resolvedTarget)

  if (_escapesBase(relativePath)) {
    throw new InvalidFilePathError(label, 'path traversal detected')
  }

  return resolvedTarget
}

/**
 * Resolves a file path, automatically allowing absolute paths if the path is absolute.
 * This is a convenience wrapper for resolvePathWithinBase that automatically sets
 * allowAbsolute=true when the provided path is absolute.
 *
 * @param basePath - The base directory path
 * @param filePath - The file path (relative or absolute)
 * @param label - Label for error messages (defaults to filePath)
 * @returns The resolved absolute path
 * @throws InvalidFilePathError if path traversal is detected or path targets protected directory
 */
export function resolveFilePath(basePath: string, filePath: string, label = filePath): string {
  const allowAbsolute = path.isAbsolute(filePath)
  return resolvePathWithinBase(basePath, filePath, label, allowAbsolute)
}
