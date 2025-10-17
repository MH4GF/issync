# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**issync** is a CLI tool that syncs text between GitHub Issue comments and local files. It enables AI-driven development by allowing AI agents to maintain living documentation (like plan.md) in GitHub Issues as a single source of truth, while multiple local sessions can read and write to the same document concurrently.

**Core Design Philosophy:**
- **AI Agent Transparency**: AI coding agents (Claude Code, Devin, etc.) should not need to know issync exists. They use normal Read()/Edit() operations on files.
- **Background Sync**: `watch` mode runs in the background, automatically syncing remote ↔ local changes.
- **Conflict Detection via Edit() Failures**: When issync pulls remote changes, Claude Code's Edit() tool naturally fails (old_string not found), triggering a re-read and retry.
- **Optimistic Locking**: Hash-based conflict detection on the push side prevents overwriting remote changes.

See `docs/plan.md` for detailed architecture decisions, progress tracking, and development phases.

## Development Commands

```bash
# Install dependencies
bun install

# Install git hooks (once per clone)
npx lefthook install

# Run CLI in development
bun run dev --help
bun run dev init <issue-url>

# Testing (Bun Test - zero config, Jest-compatible)
bun test                  # Run all tests
bun test --watch          # Watch mode
bun test <file>           # Run specific test file

# Type checking
bun run type-check

# Code quality checks
bun run check               # Biome linter and formatter
bun run check:ci            # Comprehensive checks (lint, format, type-check, test) - used by pre-commit hook
bun run knip                # Check for unused dependencies and exports
bun run knip:fix            # Auto-fix knip issues where possible

# Build for distribution
bun run build
```

**Development Workflow:**
At the start of each session, run `bun test --watch` in the background. This provides continuous feedback as you write code and ensures tests are always passing. The watch mode is fast (~150ms) and won't slow down development.

**Pre-commit Quality Checks:**
This project uses **Lefthook** to automatically enforce code quality before commits. When you attempt to commit:
- Lefthook runs `bun run check:ci` which includes:
  - Biome linting and formatting
  - ESLint checks
  - TypeScript type checking
  - All tests
- If any check fails, the commit is blocked with a clear error message
- **For AI Agents**: A task is NOT complete until all checks pass and the commit succeeds
- To manually run the same checks: `bun run check:ci`
- To temporarily skip (humans only): `LEFTHOOK=0 git commit`
- **Initial setup**: After dependency install, run `npx lefthook install` to ensure hooks are active in this clone

## Architecture

### Command Flow
1. **init**: Parse GitHub Issue URL → Create .issync.yml config → Optional initial pull
2. **pull**: Fetch remote comment → Calculate hash → Write to local file → Update config
3. **push**: Read local file → Verify remote hash (optimistic lock) → Update comment → Update config
4. **watch**: Background daemon that polls remote + watches local file changes → Auto pull/push
5. **stop**: Stop watch daemon by PID
6. **status**: Show sync state from .issync.yml

### Core Components

**`src/cli.ts`**: CLI entry point using commander.js. All commands are skeleton implementations (TODO).

**`src/lib/github.ts`**: GitHub API client wrapping Octokit.
- `parseIssueUrl()`: Extract owner/repo/issue_number from GitHub URL
- `getComment()`, `createComment()`, `updateComment()`, `listComments()`: CRUD operations on Issue comments
- `addMarker()`, `removeMarker()`, `hasIssyncMarker()`: issync comment identification using HTML comment markers
- `findIssyncComment()`: Searches for issync-managed comment by marker detection (with comment_id fallback)

**`src/lib/config.ts`**: Manages `.issync.yml` configuration file.
- `loadConfig()`, `saveConfig()`, `configExists()`: YAML read/write operations

**`src/lib/hash.ts`**: SHA-256 hash calculation for optimistic locking.

**`src/commands/watch/SessionManager.ts`**: (v0.8.2+) Manages multiple watch sessions
- `startSession()`: Start new watch session with validation
- `stopAll()`: Stop all active sessions gracefully with detailed failure tracking
- `getTrackedUrls()`: Get currently tracked issue URLs for state monitoring

**`src/commands/watch/WatchSession.ts`**: (v0.8.2+) Individual sync session management
- Remote polling (setInterval) + local file watching (chokidar)
- Grace period handling to prevent pull→push loops
- Independent error handling per session

**`src/commands/watch/StateFileWatcher.ts`**: (v0.8.2+) Monitors `.issync/state.yml` for dynamic sync addition
- Detects state file changes using chokidar
- Triggers callback when new syncs are added
- Enables watch mode to add new targets without restart

**`src/commands/watch/errorReporter.ts`**: (v0.8.2+) Unified error handling utilities
- `formatError()`: Type-safe error formatting
- `reportPreparationFailures()`: Report sync preparation failures
- `reportSessionStartupFailures()`: Report session startup failures

**`src/types/index.ts`**: Core TypeScript interfaces:
- `IssyncConfig`: .issync.yml structure (issue_url, comment_id, local_file, last_synced_hash, etc.)
- `GitHubIssueInfo`: Parsed Issue metadata (owner, repo, issue_number)
- `CommentData`: GitHub comment response (id, body, updated_at)

### Configuration File (.issync.yml)

```yaml
issue_url: https://github.com/owner/repo/issues/123
comment_id: 123456789               # Set after first sync
local_file: .issync/docs/plan-123.md
last_synced_hash: abc123def         # Remote content hash for optimistic locking
last_synced_at: 2025-10-12T10:30:00Z
poll_interval: 10                   # Seconds between remote polls
merge_strategy: section-based       # Future: smart merge (Phase 2)
watch_daemon_pid: 12345             # PID of watch process (if running)
```

### issync Comment Identification

issync uses HTML comment markers to identify managed comments within GitHub Issues:

```markdown
<!-- issync:v1:start -->
# Your document content here
...
<!-- issync:v1:end -->
```

**Design decisions:**
- **Invisible in GitHub UI**: HTML comments don't render, maintaining readability
- **Version-aware**: `v1` marker allows future format migrations
- **Redundant detection**: Uses both `comment_id` (primary) and markers (fallback)
- **Auto-repair**: If markers are deleted, `push` command automatically re-wraps content

**Identification logic:**
1. Try to fetch comment by `comment_id` from state.yml
2. If comment has markers → use it
3. If comment exists but no markers → search all comments for markers
4. If no comment_id or search fails → create new comment

This approach enables multiple sessions to discover the same remote comment without prior coordination.

## Testing Strategy

**Framework**: Bun Test (built-in, zero dependencies)
- Jest-compatible API (`describe`, `test`, `expect`)
- TypeScript native (no transpilation)
- Fast execution (~150ms for 8 tests)

**TDD Workflow**: Write tests first, then implement features.

**Test Placement**: Co-locate tests with source files (e.g., `hash.ts` → `hash.test.ts`)

### Testing Principles (Vladimir Khorikov)

Follow the **four pillars of a good test**:

1. **Protection against regressions**: Tests should catch bugs when code changes
2. **Resistance to refactoring**: Tests should not fail when refactoring (testing behavior, not implementation)
3. **Fast feedback**: Tests should run quickly
4. **Maintainability**: Tests should be easy to read and maintain

**Key Guidelines:**

- **Prefer integration tests over unit tests with mocks**: Test real behavior with real dependencies when possible
  - ✅ Test `GitHubClient` with real Octokit (or use recorded fixtures)
  - ✅ Test `config.ts` with real file system operations
  - ❌ Avoid excessive mocking that couples tests to implementation

- **Mock only external dependencies**: Mock network calls, file system in CI, or slow operations
  - GitHub API calls → Mock in some tests, use test fixtures
  - File system → Use temp directories, mock only when necessary
  - Time/Date → Mock when testing time-based logic

- **AAA Pattern**: Structure tests as Arrange, Act, Assert
  ```typescript
  test('should parse GitHub Issue URL', () => {
    // Arrange
    const client = new GitHubClient()
    const url = 'https://github.com/owner/repo/issues/123'

    // Act
    const result = client.parseIssueUrl(url)

    // Assert
    expect(result).toEqual({ owner: 'owner', repo: 'repo', issue_number: 123 })
  })
  ```

- **Test behavior, not implementation**: Focus on inputs and outputs, not internal state
  - ✅ Test that `push` updates remote comment with correct content
  - ❌ Don't test that `push` calls `calculateHash()` internally

- **One assertion per test** (when practical): Each test should verify one behavior

## Authentication

GitHub API access requires a token:
- Set `GITHUB_TOKEN` environment variable
- Or pass token to `GitHubClient` constructor
- Required scopes: `repo` (for private repos) or `public_repo` (for public repos)

## Using issync in Development Sessions

**CRITICAL: Always start watch mode BEFORE editing any synced files**

The MVP version of `pull` performs unconditional overwrites. If you start editing a file before launching watch mode, and the remote is out of date, you WILL lose local changes when watch mode starts and pulls the old remote version.

### Required Workflow (Session Start)

```bash
# 1. Set GitHub token using gh CLI
export GITHUB_TOKEN=$(gh auth token)

# 2. FIRST: Start watch mode (do this BEFORE any edits)
bun run dev watch

# 3. THEN: Begin editing files
# Claude Code or other AI agents can now safely read/edit the file
```

**Note**: We use `gh auth token` to automatically get your GitHub token from the GitHub CLI. Make sure you're logged in with `gh auth login` first.

### Important Notes

- **Never edit before watch starts**: If you edit a file and then start watch, your changes may be overwritten by an outdated remote version
- **Keep watch running**: Leave watch mode running in a separate terminal throughout your session
- **Stop with Ctrl+C**: When done, stop watch mode with Ctrl+C

### Why This Matters

The MVP's pull operation is a simple overwrite (no merge logic). This means:
- If remote is behind local → Starting watch will overwrite local with old content
- **Data loss can occur** if the workflow is not followed
- Phase 2 will implement section-based merging to reduce this risk

### Real-World Example (Actual Data Loss)

In our own development, we lost 45 lines of progress because:
1. We edited docs/plan.md locally without watch running
2. Remote Issue comment was still at an old version
3. We started watch mode
4. Pull immediately overwrote local with the old remote version
5. Had to restore from git checkout

**Lesson**: Always start watch FIRST, edit SECOND.

## Key Implementation Notes

### Optimistic Locking (Push)
1. Read local file content
2. Calculate hash
3. Fetch remote comment
4. Compare `last_synced_hash` from config with current remote hash
5. If mismatch → conflict (abort or merge)
6. If match → PATCH comment, update config with new hash

### Watch Mode Implementation
- **Remote polling**: setInterval to fetch comment every `poll_interval` seconds
- **Local file watching**: Use `chokidar` to detect file changes
- **Dynamic file addition**: Monitors `.issync/state.yml` for changes and automatically adds new sync entries to watch targets without requiring restart
  - New syncs are validated with safety checks before being added
  - Maintains partial failure tolerance using Promise.allSettled
  - Requires new syncs to have `comment_id` (must run `push` after `init`)
- **Daemon process**: Fork/spawn background process, store PID in config
- **Rate limiting**: GitHub API has 5000 req/hour limit (360 req/hour at 10s intervals per watch process)

### Phase 1 (MVP) Scope
Focus on basic sync commands (init, pull, push) and simple watch mode. Skip advanced features:
- ❌ Section-based markdown merging (Phase 2)
- ❌ Conflict resolution UI (Phase 2)
- ❌ Advanced error handling/retry logic (Phase 3)

## Current Development Status

**Completed:**
- Project setup (Bun + TypeScript)
- CLI framework skeleton (all commands stubbed)
- GitHub API client (URL parsing, CRUD operations)
- Config management (.issync.yml)
- Hash utilities
- Test infrastructure (Bun Test)
- **Phase 1 (MVP):**
  - `init` command with template support and existing comment detection
  - `pull` command with hash-based sync
  - `push` command with optimistic locking
  - `watch` mode with bidirectional sync and safety checks
  - Multi-sync support (multiple files per project)
  - Dynamic file addition to watch mode (automatically detects new syncs)
- **issync Comment Identification (2025-10-14):**
  - HTML comment markers for automatic comment discovery
  - Error handling for network failures
  - Progress indicators for long-running operations
  - Auto-repair for deleted markers
- **Code Quality Improvements (v0.8.2, 2025-10-17):**
  - Watch mode modularization (SessionManager, WatchSession, StateFileWatcher, errorReporter)
  - Enhanced error handling with type-safe formatting
  - Comprehensive test coverage (130 tests passing)

**Next Steps:**
- Phase 2: Section-based markdown merging
- Phase 2: Daemon mode for watch
- Phase 2: Conflict resolution UI

## Important Files

- `docs/plan.md`: Living development plan (progress, decisions, architecture)
- `src/types/index.ts`: Core data structures
- `.issync.yml`: Per-project configuration (git-ignored by default)
