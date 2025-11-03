# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**issync** is a CLI tool that syncs text between GitHub Issue comments and local files. It enables AI-driven development by allowing AI agents to maintain living documentation (progress documents) in GitHub Issues as a single source of truth, while multiple local sessions can read and write to the same document concurrently.

**Project Structure:**
This is a bun workspaces monorepo with the following structure:
- `packages/cli/` - The issync CLI tool (published to npm as `@mh4gf/issync`)
- `apps/` - Future: Deployable applications (e.g., orchestrator web app)
- `internal-packages/` - Future: Shared internal packages (e.g., common GitHub API client, type definitions)

**Core Design Philosophy:**
- **AI Agent Transparency**: AI coding agents (Claude Code, Devin, etc.) should not need to know issync exists. They use normal Read()/Edit() operations on files.
- **Background Sync**: `watch` mode runs in the background, automatically syncing remote ↔ local changes.
- **Conflict Detection via Edit() Failures**: When issync pulls remote changes, Claude Code's Edit() tool naturally fails (old_string not found), triggering a re-read and retry.
- **Optimistic Locking**: Hash-based conflict detection on the push side prevents overwriting remote changes.

See the progress document (`docs/plan-*.md`) for detailed architecture decisions, progress tracking, and development phases.

## Development Commands

```bash
# Install dependencies
bun install

# Install git hooks (once per clone)
npx lefthook install

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

**CLI Development:**
For CLI-specific development commands, see `packages/cli/CLAUDE.md`.

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
1. **init**: Parse GitHub Issue URL → Create state.yml config → Optional initial pull
2. **pull**: Fetch remote comment → Calculate hash → Write to local file → Update config
3. **push**: Read local file → Verify remote hash (optimistic lock) → Update comment → Update config
4. **list**: Display all sync configurations from state.yml in table format
5. **open**: Open GitHub Issue in browser for synced file → Platform-specific browser command
6. **remove**: Remove sync configuration from state.yml → Optional local file deletion
7. **clean**: Scan state.yml → Remove stale configurations (where local file does not exist) → Optional dry-run/force modes
8. **watch**: Background daemon that polls remote + watches local file changes → Auto pull/push
9. **stop**: Stop watch daemon by PID
10. **status**: Show sync state from state.yml

### Core Components

**`packages/cli/src/cli.ts`**: CLI entry point using commander.js. All commands are skeleton implementations (TODO).

**`packages/cli/src/lib/github.ts`**: GitHub API client wrapping Octokit.
- `parseIssueUrl()`: Extract owner/repo/issue_number from GitHub URL
- `getComment()`, `createComment()`, `updateComment()`, `listComments()`: CRUD operations on Issue comments
- `addMarker()`, `removeMarker()`, `hasIssyncMarker()`: issync comment identification using HTML comment markers
- `findIssyncComment()`: Searches for issync-managed comment by marker detection (with comment_id fallback)

**`packages/cli/src/lib/config.ts`**: Manages `state.yml` configuration file.
- `loadConfig()`, `saveConfig()`, `configExists()`: YAML read/write operations

**`packages/cli/src/lib/hash.ts`**: SHA-256 hash calculation for optimistic locking.

**`packages/cli/src/commands/watch/SessionManager.ts`**: Manages multiple watch sessions
- `startSession()`: Start new watch session with validation
- `stopAll()`: Stop all active sessions gracefully with detailed failure tracking
- `getTrackedUrls()`: Get currently tracked issue URLs for state monitoring

**`packages/cli/src/commands/watch/WatchSession.ts`**: Individual sync session management
- Remote polling (setInterval) + local file watching (chokidar)
- Grace period handling to prevent pull→push loops
- Independent error handling per session

**`packages/cli/src/commands/watch/StateFileWatcher.ts`**: Monitors `state.yml` for dynamic sync addition
- Detects state file changes using chokidar
- Triggers callback when new syncs are added
- Enables watch mode to add new targets without restart

**`packages/cli/src/commands/watch/errorReporter.ts`**: Unified error handling utilities
- `formatError()`: Type-safe error formatting
- `reportPreparationFailures()`: Report sync preparation failures
- `reportSessionStartupFailures()`: Report session startup failures

**`packages/cli/src/types/index.ts`**: Core TypeScript interfaces:
- `IssyncState`: state.yml structure containing array of syncs
- `IssyncSync`: Individual sync configuration (issue_url, comment_id, local_file, last_synced_hash, etc.)
- `GitHubIssueInfo`: Parsed Issue metadata (owner, repo, issue_number)
- `CommentData`: GitHub comment response (id, body, updated_at)

### Configuration File (state.yml)

issync uses a global configuration file:
- **Location**: `~/.issync/state.yml` (shared across all projects)

```yaml
syncs:
  - issue_url: https://github.com/owner/repo/issues/123
    comment_id: 123456789               # Set after first sync
    local_file: /Users/user/project/.issync/docs/plan-123.md
    last_synced_hash: abc123def         # Remote content hash for optimistic locking
    last_synced_at: 2025-10-12T10:30:00Z
    poll_interval: 10                   # Seconds between remote polls (optional)
    merge_strategy: section-based       # Future: smart merge (Phase 2, optional)
    watch_daemon_pid: 12345             # PID of watch process (if running, optional)
  - issue_url: https://github.com/owner/repo/issues/456
    comment_id: 987654321
    local_file: /Users/user/project/.issync/docs/design-456.md
    last_synced_hash: def456abc
    last_synced_at: 2025-10-13T11:00:00Z
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

**Framework**: Bun Test (Jest-compatible, TypeScript native, ~150ms execution)

**Workflow**: TDD - write tests first, co-locate with source files (`hash.ts` → `hash.test.ts`)

**Principles**: Follow Vladimir Khorikov's four pillars - protection against regressions, resistance to refactoring, fast feedback, maintainability. Prefer integration tests over mocked unit tests. Test behavior (inputs/outputs), not implementation details. Use AAA pattern (Arrange, Act, Assert).

## Authentication

GitHub API access requires a token:
- Set `GITHUB_TOKEN` environment variable
- Or pass token to `GitHubClient` constructor
- Required scopes: `repo` (for private repos) or `public_repo` (for public repos)

## Using issync in Development Sessions

**CRITICAL: Always start watch mode BEFORE editing any synced files**

The MVP's `pull` performs unconditional overwrites. Editing files before starting watch mode can result in data loss when remote is out of date.

### Required Workflow

```bash
# Ensure GITHUB_TOKEN environment variable is set
issync watch                          # Start watch FIRST
# Now safe to edit files
```

**Rules**: Never edit before watch starts. Keep watch running throughout session. Stop with Ctrl+C when done.

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
- **Local file watching**: chokidar detects file changes
- **Dynamic file addition**: Monitors `state.yml` for new syncs, validates with safety checks, maintains partial failure tolerance (Promise.allSettled). New syncs require `comment_id` (run `push` after `init`)
- **Rate limiting**: GitHub API limit 5000 req/hour (360 req/hour at 10s intervals)

## Important Files

- `docs/plan-*.md`: Progress documents - living development plans (progress, decisions, architecture)
- `src/types/index.ts`: Core data structures
- `~/.issync/state.yml`: Global configuration (shared across all projects)

## Glossary

### 進捗ドキュメント (Progress Document)

issyncで管理されるドキュメントの総称。GitHub Issueコメントとローカルファイル間で双方向同期される、プロジェクトの進捗や意思決定を記録する生きたドキュメント。

**特徴:**
- ファイル名パターン: `plan-{番号}-{slug}.md` (例: `plan-123-watch-daemon.md`)
- テンプレート: `docs/progress-document-template.md`から生成
- 用途: 開発進捗の記録、アーキテクチャ決定、タスク管理、振り返り
- 同期先: GitHub Issueコメント（HTML comment markersで識別）

**関連用語:**
- Living documentation: 継続的に更新される文書
- Single Source of Truth (SSOT): GitHub Issueを唯一の真実の情報源とする

## GitHub Actions Integration

This project uses GitHub Actions to automate AI-driven development workflows.

### Available Workflows

**`.github/workflows/claude.yml`** (Manual Claude Code invocation)
- **Trigger**: `@claude` mention in Issue comments, PR comments, or Issue/PR body
- **Purpose**: Run Claude Code on-demand for any task
- **Usage**: Comment `@claude [your instructions]` on any Issue or PR
- **Example**: `@claude fix the bug in auth.ts`

**`.github/workflows/auto-plan.yml`** (Automatic /contradiction-tools:plan execution)
- **Trigger**: Issue creation or labeling with `issync` label
- **Purpose**: Automatically execute `/contradiction-tools:plan` plugin command to create progress documents
- **Plugin**: Installs `contradiction-tools@issync-plugins` from https://github.com/MH4GF/issync marketplace
- **Usage**:
  - Create new Issue with `issync` label → auto-plan runs
  - Add `issync` label to existing Issue → auto-plan runs
- **Output**: Creates `.issync/docs/plan-{number}-{slug}.md` and syncs to Issue comment

### Setup Requirements

Both workflows require the `CLAUDE_CODE_OAUTH_TOKEN` secret:
1. Visit https://claude.ai/settings/oauth to generate a token
2. Add it to repository secrets as `CLAUDE_CODE_OAUTH_TOKEN`

### Workflow Architecture

The two workflows operate independently:
- `claude.yml`: General-purpose Claude Code execution (Issue/PR agnostic)
- `auto-plan.yml`: Specialized for `issync` labeled Issues, executes `/contradiction-tools:plan` plugin command automatically

**Important**:
- GitHub Actions cannot trigger other workflows via comments. Therefore, `auto-plan.yml` directly executes `claude-code-action` rather than posting a comment to trigger `claude.yml`.
- `auto-plan.yml` uses `plugin_marketplaces` and `plugins` parameters to install the contradiction-tools plugin before execution, enabling seamless `/contradiction-tools:plan` command usage in GitHub Actions environment.
