import { describe, expect, test } from 'bun:test'
import { InvalidFilePathError } from './errors.js'
import { resolvePathWithinBase } from './path.js'

describe('resolvePathWithinBase', () => {
  const basePath = '/base'

  describe('when path is valid', () => {
    // Directory names starting with ".." are legitimate names, not traversal attempts
    test('allows directory names starting with ".."', () => {
      // Arrange
      const targetPath = '..docs/plan.md'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath)

      // Assert: Should resolve to a path within the base directory
      expect(result).toBe('/base/..docs/plan.md')
    })

    test('allows nested directories with ".." in name', () => {
      // Arrange
      const targetPath = 'foo/..bar/file.md'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath)

      // Assert
      expect(result).toBe('/base/foo/..bar/file.md')
    })

    test('allows multiple dots in directory names', () => {
      // Arrange
      const targetPath = '...config/settings.yml'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath)

      // Assert
      expect(result).toBe('/base/...config/settings.yml')
    })

    test('resolves simple file paths', () => {
      // Arrange
      const targetPath = 'docs/plan.md'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath)

      // Assert
      expect(result).toBe('/base/docs/plan.md')
    })
  })

  describe('when path attempts traversal', () => {
    // Path traversal using ".." as a directory separator is a security risk
    test('blocks parent directory reference', () => {
      // Arrange
      const targetPath = '../etc/passwd'

      // Act & Assert: Should throw InvalidFilePathError to prevent directory traversal
      expect(() => resolvePathWithinBase(basePath, targetPath, targetPath)).toThrow(
        InvalidFilePathError,
      )
    })

    test('blocks nested parent directory reference', () => {
      // Arrange
      const targetPath = 'foo/../../etc/passwd'

      // Act & Assert
      expect(() => resolvePathWithinBase(basePath, targetPath, targetPath)).toThrow(
        InvalidFilePathError,
      )
    })

    test('blocks multiple parent directory references', () => {
      // Arrange
      const targetPath = '../../../../../../etc/passwd'

      // Act & Assert
      expect(() => resolvePathWithinBase(basePath, targetPath, targetPath)).toThrow(
        InvalidFilePathError,
      )
    })

    test('blocks parent reference in middle of path', () => {
      // Arrange
      const targetPath = 'foo/../../../bar'

      // Act & Assert
      expect(() => resolvePathWithinBase(basePath, targetPath, targetPath)).toThrow(
        InvalidFilePathError,
      )
    })

    test('blocks absolute paths', () => {
      // Arrange
      const targetPath = '/etc/passwd'

      // Act & Assert: Absolute paths should be blocked to prevent directory traversal
      expect(() => resolvePathWithinBase(basePath, targetPath, targetPath)).toThrow(
        InvalidFilePathError,
      )
    })
  })

  describe('when path has edge cases', () => {
    test('resolves empty string to base directory', () => {
      // Arrange
      const targetPath = ''

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath)

      // Assert
      expect(result).toBe('/base')
    })

    test('resolves current directory reference', () => {
      // Arrange
      const targetPath = '.'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath)

      // Assert
      expect(result).toBe('/base')
    })

    test('resolves "./file.md" to base directory file', () => {
      // Arrange
      const targetPath = './docs/plan.md'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath)

      // Assert
      expect(result).toBe('/base/docs/plan.md')
    })
  })
})
