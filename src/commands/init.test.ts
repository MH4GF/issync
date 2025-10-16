import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig } from '../lib/config'
import { FileAlreadyExistsError, InvalidFilePathError } from '../lib/errors'
import * as githubModule from '../lib/github'
import { calculateHash } from '../lib/hash'
import { createMockGitHubClient } from '../lib/test-helpers'
import type { CommentData } from '../types/index'
import { init } from './init'

const TEST_DIR = path.join(import.meta.dir, '../../.test-tmp/init-test')

describe('init command', () => {
  beforeEach(async () => {
    // Create clean test directory
    await rm(TEST_DIR, { recursive: true, force: true })
    await mkdir(TEST_DIR, { recursive: true })

    // Default: no existing comment
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(createMockGitHubClient())
  })

  afterEach(async () => {
    // Cleanup
    await rm(TEST_DIR, { recursive: true, force: true })
    mock.restore()
  })

  test('creates .issync directory and state.yml with valid Issue URL', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/plan.md'

    await init(issueUrl, { file: localFile, cwd: TEST_DIR })

    // Check .issync directory exists
    const issyncDir = path.join(TEST_DIR, '.issync')
    expect(existsSync(issyncDir)).toBe(true)

    // Check state.yml exists and has correct content
    const stateFile = path.join(issyncDir, 'state.yml')
    expect(existsSync(stateFile)).toBe(true)

    // Check local file was created with default template
    const targetFile = path.join(TEST_DIR, localFile)
    expect(existsSync(targetFile)).toBe(true)
    const content = readFileSync(targetFile, 'utf-8')
    // Verify template was fetched (not empty)
    expect(content).toBeTruthy()
    expect(content.length).toBeGreaterThan(0)

    const state = loadConfig(TEST_DIR)
    expect(state.syncs).toHaveLength(1)
    const config = state.syncs[0]

    expect(config?.issue_url).toBe(issueUrl)
    expect(config?.local_file).toBe(localFile)
    expect(config?.comment_id).toBeUndefined()
    expect(config?.last_synced_hash).toBeUndefined()
  })

  test('uses default file path when not specified', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'

    await init(issueUrl, { cwd: TEST_DIR })

    const state = loadConfig(TEST_DIR)
    expect(state.syncs).toHaveLength(1)
    const config = state.syncs[0]

    expect(config?.local_file).toBe('.issync/docs/plan-123.md')

    // Verify file was actually created at the expected path
    const expectedFilePath = path.join(TEST_DIR, '.issync/docs/plan-123.md')
    expect(existsSync(expectedFilePath)).toBe(true)
  })

  test('uses user-provided file path when --file option is specified', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const customPath = 'custom/path/plan.md'

    await init(issueUrl, { file: customPath, cwd: TEST_DIR })

    const state = loadConfig(TEST_DIR)
    expect(state.syncs).toHaveLength(1)
    const config = state.syncs[0]

    expect(config?.local_file).toBe(customPath)

    // Verify file was actually created at the custom path
    const createdFile = path.join(TEST_DIR, customPath)
    expect(existsSync(createdFile)).toBe(true)
  })

  test('generates unique paths for different issue numbers', async () => {
    await init('https://github.com/owner/repo/issues/1', { cwd: TEST_DIR })
    await init('https://github.com/owner/repo/issues/999', { cwd: TEST_DIR })

    const state = loadConfig(TEST_DIR)
    expect(state.syncs).toHaveLength(2)
    expect(state.syncs[0]?.local_file).toBe('.issync/docs/plan-1.md')
    expect(state.syncs[1]?.local_file).toBe('.issync/docs/plan-999.md')

    // Verify both files were created
    expect(existsSync(path.join(TEST_DIR, '.issync/docs/plan-1.md'))).toBe(true)
    expect(existsSync(path.join(TEST_DIR, '.issync/docs/plan-999.md'))).toBe(true)
  })

  test('dynamic default path works with template option', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/456'
    const templateContent = '# Template Content\n\nSome content here'
    const templatePath = path.join(TEST_DIR, 'template.md')

    writeFileSync(templatePath, templateContent, 'utf-8')

    await init(issueUrl, { cwd: TEST_DIR, template: 'template.md' })

    const state = loadConfig(TEST_DIR)
    const targetFile = state.syncs[0]?.local_file
    expect(targetFile).toBe('.issync/docs/plan-456.md')

    // Verify template content was used
    if (!targetFile) {
      throw new Error('targetFile is undefined')
    }
    const content = readFileSync(path.join(TEST_DIR, targetFile), 'utf-8')
    expect(content).toBe(templateContent)
  })

  test('creates file from template when provided', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/notes/plan.md'
    const templatesDir = path.join(TEST_DIR, 'templates')
    const templateFile = path.join(templatesDir, 'base.md')

    mkdirSync(templatesDir, { recursive: true })
    writeFileSync(templateFile, '# Template', 'utf-8')

    await init(issueUrl, {
      file: localFile,
      cwd: TEST_DIR,
      template: path.relative(TEST_DIR, templateFile),
    })

    const createdFile = path.join(TEST_DIR, localFile)
    expect(existsSync(createdFile)).toBe(true)
    expect(readFileSync(createdFile, 'utf-8')).toBe('# Template')
  })

  test('creates file from URL template when provided', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/custom.md'
    // Use the actual default template URL to test real HTTP fetch
    const templateUrl =
      'https://raw.githubusercontent.com/MH4GF/issync/refs/heads/main/docs/plan-template.md'

    await init(issueUrl, {
      file: localFile,
      cwd: TEST_DIR,
      template: templateUrl,
    })

    const createdFile = path.join(TEST_DIR, localFile)
    expect(existsSync(createdFile)).toBe(true)
    const content = readFileSync(createdFile, 'utf-8')
    // Verify content was fetched from URL (not empty)
    expect(content).toBeTruthy()
    expect(content.length).toBeGreaterThan(0)
  })

  test('throws error for unreachable URL template', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const invalidUrl = 'https://raw.githubusercontent.com/invalid-domain-123456/issync/main/none.md'

    expect(init(issueUrl, { template: invalidUrl, cwd: TEST_DIR })).rejects.toThrow(
      /Failed to fetch template/,
    )
  })

  test('allows existing file when template not provided', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/plan.md'
    const targetFile = path.join(TEST_DIR, localFile)
    const originalContent = 'existing'

    mkdirSync(path.dirname(targetFile), { recursive: true })
    writeFileSync(targetFile, originalContent, 'utf-8')

    await init(issueUrl, { file: localFile, cwd: TEST_DIR })

    expect(readFileSync(targetFile, 'utf-8')).toBe(originalContent)
  })

  test('throws error when template is provided and target file exists', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = 'docs/plan.md'
    const targetFile = path.join(TEST_DIR, localFile)
    const templateFile = path.join(TEST_DIR, 'templates', 'base.md')

    mkdirSync(path.dirname(targetFile), { recursive: true })
    mkdirSync(path.dirname(templateFile), { recursive: true })
    writeFileSync(targetFile, 'existing', 'utf-8')
    writeFileSync(templateFile, '# Template', 'utf-8')

    expect(
      init(issueUrl, {
        file: localFile,
        cwd: TEST_DIR,
        template: path.relative(TEST_DIR, templateFile),
      }),
    ).rejects.toThrow(FileAlreadyExistsError)
  })

  test('accepts file paths containing leading double dots in the name', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const localFile = '..docs/plan.md'

    await init(issueUrl, { file: localFile, cwd: TEST_DIR })

    const createdFile = path.join(TEST_DIR, localFile)
    expect(existsSync(createdFile)).toBe(true)
    const content = readFileSync(createdFile, 'utf-8')
    // Verify file was created with content
    expect(content).toBeTruthy()
    expect(content.length).toBeGreaterThan(0)
  })

  test('rejects file paths that escape the working directory', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'

    expect(init(issueUrl, { file: '../plan.md', cwd: TEST_DIR })).rejects.toThrow(
      InvalidFilePathError,
    )
  })

  test('throws error for invalid GitHub Issue URL', () => {
    const invalidUrl = 'https://github.com/owner/repo/pull/123' // PR URL, not Issue

    expect(init(invalidUrl, { cwd: TEST_DIR })).rejects.toThrow()
  })

  test('throws error when issue is already tracked', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'

    // First initialization
    await init(issueUrl, { cwd: TEST_DIR })

    // Second initialization should fail
    expect(init(issueUrl, { cwd: TEST_DIR })).rejects.toThrow(/Sync already exists for issue/)
  })

  test('throws error when local file is already tracked', async () => {
    const issueUrl1 = 'https://github.com/owner/repo/issues/123'
    const issueUrl2 = 'https://github.com/owner/repo/issues/456'
    const localFile = 'docs/plan.md'

    await init(issueUrl1, { cwd: TEST_DIR, file: localFile })

    expect(init(issueUrl2, { cwd: TEST_DIR, file: localFile })).rejects.toThrow(
      /Sync already exists for local file/,
    )
  })

  test('allows multiple sync entries for different issues and files', async () => {
    await init('https://github.com/owner/repo/issues/1', { cwd: TEST_DIR, file: 'docs/plan.md' })
    await init('https://github.com/owner/repo/issues/2', {
      cwd: TEST_DIR,
      file: 'docs/notes.md',
    })

    const state = loadConfig(TEST_DIR)
    expect(state.syncs).toHaveLength(2)
    const files = state.syncs.map((sync) => sync.local_file).sort()
    expect(files).toEqual(['docs/notes.md', 'docs/plan.md'])
  })

  test('creates .issync directory if it does not exist', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    const issyncDir = path.join(TEST_DIR, '.issync')

    expect(existsSync(issyncDir)).toBe(false)

    await init(issueUrl, { cwd: TEST_DIR })

    expect(existsSync(issyncDir)).toBe(true)
  })

  test('pulls existing comment when remote issync comment exists', async () => {
    // Arrange
    const issueUrl = 'https://github.com/owner/repo/issues/1'
    const localFile = 'test.md'
    const targetPath = path.join(TEST_DIR, localFile)
    const existingContent = '# Existing Content'
    const wrappedContent = githubModule.addMarker(existingContent)

    const mockComment: CommentData = {
      id: 123,
      body: wrappedContent,
      updated_at: '2025-01-01T00:00:00Z',
    }

    // Mock createGitHubClient to return a client with the existing comment
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      createMockGitHubClient({
        findIssyncComment: mock(() => Promise.resolve(mockComment)),
      }),
    )

    // Act
    await init(issueUrl, { file: localFile, cwd: TEST_DIR })

    // Assert
    expect(existsSync(targetPath)).toBe(true)
    expect(readFileSync(targetPath, 'utf-8')).toBe(existingContent) // unwrapped

    const state = loadConfig(TEST_DIR)
    const sync = state.syncs[0]
    expect(sync).toBeDefined()
    expect(sync?.comment_id).toBe(123)
    expect(sync?.last_synced_hash).toBe(calculateHash(existingContent))
    expect(sync?.last_synced_at).toBeDefined()
  })

  test('fallback to template when remote comment fetch fails', async () => {
    // Arrange
    const issueUrl = 'https://github.com/owner/repo/issues/1'
    const localFile = 'test.md'
    const targetPath = path.join(TEST_DIR, localFile)

    // Mock createGitHubClient to throw an error (network failure)
    spyOn(githubModule, 'createGitHubClient').mockReturnValue(
      createMockGitHubClient({
        findIssyncComment: mock(() => Promise.reject(new Error('Network error'))),
      }),
    )

    // Act
    await init(issueUrl, { file: localFile, cwd: TEST_DIR })

    // Assert - should fall back to template initialization
    expect(existsSync(targetPath)).toBe(true)
    const content = readFileSync(targetPath, 'utf-8')
    expect(content).toBeTruthy() // Has content from template

    const state = loadConfig(TEST_DIR)
    const sync = state.syncs[0]
    expect(sync).toBeDefined()
    expect(sync?.comment_id).toBeUndefined() // No comment_id since pull failed
    expect(sync?.last_synced_hash).toBeUndefined()
  })
})
