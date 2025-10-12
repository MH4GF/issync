import { describe, expect, test } from 'bun:test'
import { calculateHash } from './hash'

describe('calculateHash', () => {
  // 楽観ロックでは、同じコンテンツは常に同じハッシュを生成する必要がある
  test('同じ入力に対して一貫したハッシュを返す', () => {
    // Arrange
    const content = 'Hello, World!'

    // Act
    const hash1 = calculateHash(content)
    const hash2 = calculateHash(content)

    // Assert: 楽観ロックの正確性のために一貫性が重要
    expect(hash1).toBe(hash2)
  })

  // 楽観ロックでは、異なるコンテンツは異なるハッシュを生成する必要がある
  test('異なる入力に対して異なるハッシュを返す', () => {
    // Arrange
    const content1 = 'Hello'
    const content2 = 'World'

    // Act
    const hash1 = calculateHash(content1)
    const hash2 = calculateHash(content2)

    // Assert: 衝突回避は楽観ロックの信頼性に不可欠
    expect(hash1).not.toBe(hash2)
  })

  // エッジケース: 空のドキュメントでも同期できる必要がある
  test('空文字列でもハッシュを計算できる', () => {
    // Arrange
    const content = ''

    // Act
    const hash = calculateHash(content)

    // Assert: クラッシュせずに有効なハッシュ値を返す
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })

  // 大きなコンテンツでも正常に動作する
  test('長い文字列でもハッシュを計算できる', () => {
    // Arrange: 実際のドキュメントサイズをシミュレート
    const content = 'a'.repeat(10000)

    // Act
    const hash = calculateHash(content)

    // Assert
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })
})
