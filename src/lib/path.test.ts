import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import { InvalidFilePathError } from './errors.js'
import { resolveFilePath, resolvePathWithinBase } from './path.js'

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

  describe('when allowAbsolute is true', () => {
    test('allows absolute paths', () => {
      // Arrange: Absolute paths are allowed
      const targetPath = '/Users/user/projects/repo/docs/plan.md'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath, true)

      // Assert: Absolute path should be returned as-is
      expect(result).toBe('/Users/user/projects/repo/docs/plan.md')
    })

    test('allows absolute paths on Windows', () => {
      // Arrange: Windows absolute path
      const targetPath = 'C:\\Users\\user\\projects\\repo\\docs\\plan.md'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath, true)

      // Assert: Windows absolute path should be returned as-is (normalized)
      expect(result).toContain('plan.md')
    })

    test('still resolves relative paths correctly', () => {
      // Arrange: Relative path with allowAbsolute=true
      const targetPath = 'docs/plan.md'

      // Act
      const result = resolvePathWithinBase(basePath, targetPath, targetPath, true)

      // Assert: Should resolve relative to base
      expect(result).toBe(path.join(basePath, 'docs/plan.md'))
    })

    test('throws error for /etc path (Unix)', () => {
      // Arrange: System-critical path
      const dangerousPath = '/etc/passwd'

      // Act & Assert
      expect(() => resolvePathWithinBase(basePath, dangerousPath, 'local_file', true)).toThrow(
        'absolute path targets protected system directory',
      )
    })

    test('throws error for /sys path (Unix)', () => {
      // Arrange: System-critical path
      const dangerousPath = '/sys/kernel/config'

      // Act & Assert
      expect(() => resolvePathWithinBase(basePath, dangerousPath, 'local_file', true)).toThrow(
        'absolute path targets protected system directory',
      )
    })

    test('throws error for /proc path (Unix)', () => {
      // Arrange: System-critical path
      const dangerousPath = '/proc/cpuinfo'

      // Act & Assert
      expect(() => resolvePathWithinBase(basePath, dangerousPath, 'local_file', true)).toThrow(
        'absolute path targets protected system directory',
      )
    })

    test('throws error for Windows System32 path', () => {
      // Arrange: Windows system-critical path - only test on Windows
      if (process.platform !== 'win32') {
        // Skip test on non-Windows platforms
        return
      }

      const dangerousPath = 'C:\\Windows\\System32\\config'

      // Act & Assert
      expect(() => resolvePathWithinBase(basePath, dangerousPath, 'local_file', true)).toThrow(
        'absolute path targets protected system directory',
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

describe('resolveFilePath', () => {
  const basePath = '/base'

  test('automatically allows absolute paths', () => {
    // Arrange: Absolute path should be allowed automatically
    const filePath = '/Users/user/projects/docs/plan.md'

    // Act
    const result = resolveFilePath(basePath, filePath)

    // Assert: Should return absolute path as-is
    expect(result).toBe('/Users/user/projects/docs/plan.md')
  })

  test('resolves relative paths correctly', () => {
    // Arrange: Relative path should be resolved to base
    const filePath = 'docs/plan.md'

    // Act
    const result = resolveFilePath(basePath, filePath)

    // Assert: Should resolve relative to base
    expect(result).toBe(path.join(basePath, 'docs/plan.md'))
  })

  test('throws error for dangerous absolute paths', () => {
    // Arrange: System-critical path
    const dangerousPath = '/etc/passwd'

    // Act & Assert
    expect(() => resolveFilePath(basePath, dangerousPath)).toThrow(
      'absolute path targets protected system directory',
    )
  })

  test('throws error for path traversal with relative paths', () => {
    // Arrange: Path traversal attempt
    const traversalPath = '../etc/passwd'

    // Act & Assert
    expect(() => resolveFilePath(basePath, traversalPath)).toThrow('path traversal detected')
  })
})
