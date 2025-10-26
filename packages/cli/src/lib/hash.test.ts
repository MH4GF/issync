import { describe, expect, test } from 'bun:test'
import { calculateHash } from './hash'

describe('calculateHash', () => {
  // For optimistic locking, the same content must always generate the same hash
  test('returns consistent hash for the same input', () => {
    // Arrange
    const content = 'Hello, World!'

    // Act
    const hash1 = calculateHash(content)
    const hash2 = calculateHash(content)

    // Assert: Consistency is critical for optimistic locking accuracy
    expect(hash1).toBe(hash2)
  })

  // For optimistic locking, different content must generate different hashes
  test('returns different hashes for different inputs', () => {
    // Arrange
    const content1 = 'Hello'
    const content2 = 'World'

    // Act
    const hash1 = calculateHash(content1)
    const hash2 = calculateHash(content2)

    // Assert: Collision avoidance is essential for optimistic locking reliability
    expect(hash1).not.toBe(hash2)
  })

  // Edge case: Empty documents should also be syncable
  test('can calculate hash for empty string', () => {
    // Arrange
    const content = ''

    // Act
    const hash = calculateHash(content)

    // Assert: Should return a valid hash value without crashing
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })

  // Should work correctly even with large content
  test('can calculate hash for long strings', () => {
    // Arrange: Simulate actual document size
    const content = 'a'.repeat(10000)

    // Act
    const hash = calculateHash(content)

    // Assert
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })
})
