import path from 'node:path'
import { InvalidFilePathError } from './errors.js'

function hasTraversal(relativePath: string): boolean {
  const normalized = relativePath === '' ? '.' : path.normalize(relativePath)

  if (path.isAbsolute(normalized)) {
    return true
  }

  return normalized.split(path.sep).some((segment) => segment === '..')
}

export function resolvePathWithinBase(
  basePath: string,
  targetPath: string,
  label = targetPath,
): string {
  const resolvedBase = path.resolve(basePath)
  const resolvedTarget = path.resolve(resolvedBase, targetPath)
  const relativePath = path.relative(resolvedBase, resolvedTarget)

  if (hasTraversal(relativePath)) {
    throw new InvalidFilePathError(label, 'path traversal detected')
  }

  return resolvedTarget
}
